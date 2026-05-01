---
playbook: pre-authoring-stance
status: active
since: 2026-04-30
applies_to: universal
---

# PROTOCOL pre-authoring-stance

The cognitive ritual that runs before authoring any sub-section. The Quality Bar gates verify *output*; this stance check catches *intent*. Local optimization without holding the global picture is the recurring failure mode the gates cannot catch — only this check can, because it fires at the moment of authoring.

## trigger

Any new sub-section about to be authored. **Run before each sub-section, not just at item start** — a single work item can author several sub-sections, and intent can drift between them.

## inputs

- change scope — what this sub-section will assert / cover / claim
- target repo + target file
- the active pillar's canonical-homes file (e.g., `pillars/documentation/canonical-homes.md`)
- the active pillar's cornerstones file (e.g., `pillars/documentation/cornerstones.md`)
- the active pillar's pillar.md (the bar — `pillars/documentation/pillar.md` for documentation work)

## procedure

The five questions, asked in order. Each must be answered without hedging.

1. **What content type is this section?**

   Per the active pillar's canonical-homes table. Examples for documentation: Feature description / API reference / Configuration reference / Deployment / ADR / Glossary entry / Developer guide / Integration / Example / Troubleshooting / Other.

   **If you can't name the type**, name it now — the taxonomy is incomplete and a Cornerstone-5 decision is owed before authoring. Stop and propose a new content type before continuing.

2. **Where is the canonical home for this type?**

   Per the active pillar's canonical-homes file. Three legitimate outcomes:

   - Home exists and contains the content → link to its relevant section/anchor; do not embed.
   - Home exists but is sparse for this case → extend the home with the new content, link from the feature page.
   - No canonical home today → propose one as a Cornerstone-5 decision before authoring, or log a backlog item if scope-deferred.

   **Do not silently embed on a feature page.**

3. **Where does this page sit in the global SUMMARY taxonomy?**

   Per the active pillar's cornerstones file (Cornerstone 2 — hierarchy depth must reflect conceptual depth). Walk the SUMMARY tree from root:

   - At the depth this page is placed, are its siblings conceptual peers — or is one of them actually the parent group?
   - Is the chosen parent the conceptually broadest reasonable one, or does the page belong under a more general parent?
   - Does the parent's existing child set form a peer group this page joins — or is the page being placed *next to* a parent group rather than *inside* it?

4. **Does this change preserve the WHY?**

   Read the active pillar's `pillar.md` "The bar — stated explicitly". Is an operator three years from now better off because we did this, or just locally satisfied because we ticked the AC box?

   "Locally satisfied" is fail. The Quality Bar gates won't catch this — only this question will, because the gates verify *output* whereas this catches *intent*.

5. **Would I be ashamed to see this change quoted back to me by an angry operator?**

   The Pride-as-Mechanism rule (`CLAUDE.md` "The project and the maintainer"). If the answer requires hedging — "well, it's the same as the other pages", "the bar wasn't established yet", "we can fix it later" — the change isn't ready. World-class is the standard; everything below it is a regression.

## exit

All five questions answered without hedging. The sub-section may be authored.

## on-fail

If any question reveals a structural mismatch:

- **Stop authoring.**
- Address the structural question first: extend the canonical home; propose a new content type; escalate the IA decision to the user; rewrite the SUMMARY placement.
- Do **not** ship a locally-good change you know is globally drift-producing. The cost of escalating is small; the cost of accumulating drift is the entire mission.

## case-law

- `retrospectives/LSN-006-lookup-tables-content-homing.md` — question 2 would have caught it: the content type is API reference, the canonical home is `developer-guides/api-reference`, the feature page should link not embed.
- `retrospectives/LSN-007-summary-convenience-placements.md` — question 3 would have caught it: the chosen siblings (top-level entries) were not conceptual peers of `Directory` / `GenAI assistant` / `Build a custom collector`.
