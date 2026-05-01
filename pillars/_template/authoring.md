---
pillar: <name>
file: authoring
status: template
---

# <Pillar name> authoring rules

Surface-specific conventions that universal Quality Bar gates do not catch — link semantics, build-system caveats, file-layout conventions, commit-footer formats.

## How to author this file

For each surface convention the pillar's authoring requires, write a section. Pattern:

- **Convention.** One paragraph stating the rule. One paragraph naming the failure mode this rule prevents. Cite `retrospectives/LSN-NNN-{slug}.md` for the canonical case if one exists.

The documentation pillar's authoring rules (`pillars/documentation/authoring.md`) cover GitBook-specific link semantics, multi-PR caching, in-page TOC sync, branch staleness, and the `Sources:` footer format.

## <Surface> authoring

<Convention 1 with retrospectives/LSN-NNN if applicable.>

<Convention 2 with retrospectives/LSN-NNN if applicable.>

## The `Sources:` footer

Every implementation commit on this pillar's surface includes a `Sources:` footer citing the canonical source of truth for each factual claim class the change touches. The footer drives Gate 9 (`pillars/<name>/gates.md` Factual claim provenance + `playbooks/claim-inventory.md`).

<Pillar-specific footer format example.>

Pure prose-polish items with no factual claim write `Sources: none (prose polish, no factual claim)` explicitly — silence is not acceptable.
