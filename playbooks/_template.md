---
playbook: <name>
status: draft | active
since: YYYY-MM-DD
applies_to: universal | pillar:<name>
---

# PROTOCOL <name>

One-line restatement of what this protocol enforces.

## trigger

When does this protocol fire? Be specific about the *event* that causes a maintainer to invoke it. Examples:

- any factual runtime claim about config, SDK, feature, or error behavior
- any new sub-section about to be authored
- any commit that touches files under `application.yml` or a `@Value` consumer

## inputs

What does the operator bring in? One bullet per input.

- claim text
- claim class (one of: config / SDK / feature / error / spec / lifecycle / dep / repo / integration / term)
- target repo

## procedure

Numbered, executable steps.

1. First step — what to do, with the tool/file path that supports it.
2. Second step — what to read or compute.
3. Third step — etc.

Steps may invoke sub-playbooks: `→ run playbook unset-parameter-audit if claim class is SDK`.

## exit

The verifiable end-condition. The protocol is done when:

- exit condition 1
- exit condition 2

## on-fail

What to do if the exit condition cannot be reached. Typically one of:

- drop the claim
- mark the item `blocked` and surface to user
- escalate the structural question before authoring continues
- run a different playbook first, then retry

## case-law

The retrospectives that justify the current shape of this protocol. One bullet per LSN.

- `retrospectives/LSN-NNN-{slug}.md` — one-line summary of what this case taught
- `retrospectives/LSN-MMM-{slug}.md` — etc.