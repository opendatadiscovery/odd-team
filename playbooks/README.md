---
directory: playbooks
purpose: reusable PROTOCOL-format operational protocols
---

# Playbooks

Each file in this directory is a single operational protocol — the executable shape of a Quality Bar gate. The directory is the universal-gate side of the framework: pillar gates in `pillars/{name}/gates.md` cite playbooks here and add pillar-specific extensions.

## PROTOCOL format

Every playbook follows the same shape:

```
PROTOCOL <name>
  trigger:    What event causes this protocol to fire (e.g., "any factual runtime claim",
              "any new sub-section about to be authored").

  inputs:     What information the operator brings into the protocol (e.g., "claim text + claim class",
              "change scope + target repo + target file"). One bullet per input.

  procedure:  Numbered, executable steps. Each step is something a maintainer (human or AI) can do
              with the tools available in `CLAUDE.md`. Avoid unbounded prose; if a step needs
              elaboration, link to a sub-playbook.

  exit:       The verifiable end-condition that proves the protocol completed correctly.
              "Every claim has a Sources: footer line", not "the maintainer feels done".

  on-fail:    What to do if the exit condition cannot be reached.
              Usually one of: drop the claim, mark the item blocked, escalate to user,
              run a different playbook first.

  case-law:   References to retrospectives (`retrospectives/LSN-NNN-{slug}.md`) that justify
              this protocol. The why-it-exists is in the retros, not embedded here.
```

## When to add a playbook

A new playbook is justified when:

- A rule applies across pillars (e.g., consumer-read applies to docs, tests, features alike) AND
- The rule has a clear trigger / inputs / procedure / exit / on-fail / case-law signature.

Pillar-specific rules go in `pillars/{name}/gates.md`. They MAY cite a playbook for the universal core.

## When to update a playbook

When a retrospective adds new case-law that changes the procedure, update the playbook in the same commit that adds the retrospective. The `case-law:` line lists every LSN that justifies the current shape.

## Files in this directory (status as of 2026-05-01)

| File | Status | Phase that populates it |
|---|---|---|
| `_template.md` | scaffold | Phase 1 |
| `consumer-read.md` | not yet | Phase 4 |
| `unset-parameter-audit.md` | not yet | Phase 4 |
| `duplication-sweep.md` | not yet | Phase 4 |
| `pre-authoring-stance.md` | not yet | Phase 4 |
| `claim-inventory.md` | not yet | Phase 4 |
| `live-site-verification.md` | not yet | Phase 4 |
| `follow-up-on-disk.md` | not yet | Phase 4 |