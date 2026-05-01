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

## Files in this directory

| File | Status | Phase | Trigger | Cited from |
|---|---|---|---|---|
| `_template.md` | scaffold | Phase 1 | — | — |
| `consumer-read.md` | active | Phase 4 | any factual runtime claim | Gate 4 (`pillars/documentation/gates.md`) |
| `unset-parameter-audit.md` | active | Phase 4 | any SDK-backed integration change | Gate 5 (`pillars/documentation/gates.md`) |
| `duplication-sweep.md` | active | Phase 4 | any new page / term / URL / repo | Gate 1 (`pillars/documentation/gates.md`) |
| `pre-authoring-stance.md` | active | Phase 4 | any new sub-section about to be authored | Pre-authoring stance check (`pillars/documentation/gates.md`) |
| `claim-inventory.md` | active | Phase 4 | drafting the `Sources:` commit footer | Gate 9 (`pillars/documentation/gates.md`) |
| `live-site-verification.md` | active | Phase 4 | reviewing a merged item | Gate 8 (`pillars/documentation/gates.md`) |
| `follow-up-on-disk.md` | active | Phase 4 | any phase discovering an out-of-scope issue | "Follow-up work must be logged on disk" (`CLAUDE.md`) |

## Sub-protocol relationships

- `playbooks/consumer-read.md` invokes `playbooks/unset-parameter-audit.md` for the `SDK` claim class.
- `playbooks/claim-inventory.md` invokes `playbooks/consumer-read.md` for the `Config` / `SDK` / `Feature` / `Error` classes; invokes `playbooks/unset-parameter-audit.md` for the `Builder` class; invokes `playbooks/duplication-sweep.md` step 3 for the `Backlog` class.
- `playbooks/duplication-sweep.md` step 2 invokes `playbooks/claim-inventory.md` for new outbound URLs.
- `playbooks/follow-up-on-disk.md` invokes `playbooks/duplication-sweep.md` step 3 for the grep-backlog-first rule.