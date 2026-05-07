---
id: LSN-014
title: Closing turns punted with "your call" / multi-option open-enders instead of structured interview
date: 2026-05-08
domain: documentation (cross-pillar — applies to any phase that prompts the user)
severity: medium
gates_informed:
  - playbooks/pause-and-ask.md (the rule that emerged)
  - feedback_pause_and_ask_well.md (auto-memory)
  - CLAUDE.md "When to pause and ask the user" (the WHEN — this playbook is the HOW)
status: closed
---

# LSN-014: Vague interview closers in the lineage-substrate session

## What happened

Across the 2026-05-08 lineage-substrate session, multiple turns closed with vague prompts that punted framing onto the user instead of asking specific decisions:

- *"Want me to draft the ADR? I'll capture the design questions, the prior art, the staleness/scope trade-offs, and the proposed MVP shape — leaving the call to you, not pre-deciding it."*
- *"Want me to walk you through the open questions, or would you rather review the file directly first?"*
- *"The ADR remains pending one binary call from you: adopt / defer / reject the substrate. Everything else is decided or codified for the next maintainer who picks up an ADR draft and starts listing options."*
- *"Your call."*

Each looked polite — *deferring* to the user. In practice each forced the user to do framing-work the implementer should have done: *what is the actual decision space? what changes the recommendation? what does silence mean? which question is urgent vs nice-to-know?*

The user pushed back: *"what answers should I answer? Could not you learn how this process of interviewing a user should look like?"*

The miss was about **interview shape**, not interview frequency. The questions themselves were legitimate (the substrate genuinely needs adopt/defer/reject input from the maintainer); the problem was framing them as punts instead of structured prompts.

## Why it slipped

The workspace's velocity discipline (`feedback_laser_focus_velocity.md`, `playbooks/deep-research.md`) covers two failure modes — looping on already-resolved decisions, and punting research as user questions. Neither covered the third sibling: **structuring the question well when a question is genuinely needed**.

CLAUDE.md's "When to pause and ask the user" section names the **WHEN** — five trigger conditions for surfacing decisions. It does not name the **HOW**. So the implementer correctly recognised "this is a pause-and-ask moment" and then proceeded to ask in the worst-possible shape: open-ended, multi-option, no recommendation, no blast radius, no silence-is-an-answer escape.

The vague closer also looks (to a tired implementer) like the *opposite* of punting — "I'm letting the user choose." But "letting the user choose" without surfacing what changes the recommendation is paternalism dressed as deference: the user has to reverse-engineer the decision shape from the implementer's framing, which is exactly the cost the implementer was supposed to absorb.

## Rule that emerged

`playbooks/pause-and-ask.md` — codifies the **how** of user prompts, complementing CLAUDE.md's **when**. Five-step procedure: (1) state the default, (2) list only questions where the answer changes the default, (3) format each with blast radius + recommendation + what-changes-it, (4) order by blast radius, (5) provide silence-is-an-answer for non-blocking questions. Soft cap at 3 questions; ≥4 means research is being punted (`deep-research.md` fires instead).

CLAUDE.md gains a one-line pointer to the playbook in the "When to pause and ask the user" section.

`feedback_pause_and_ask_well.md` (auto-memory) carries the same rule for solo session memory.

## Forcing question

Before closing a turn with a question: *"Did I state what happens if the user says nothing? Did each question name what only the user knows that would change the recommendation? Could the user answer with one word per question?"*

## References

- File:line evidence: 2026-05-08 conversation closers in this session — verbatim quoted in "What happened" above.
- Originating thread: 2026-05-08 lineage-substrate session (i18n probe → ADR → research-punt LSN-013 → vague-closer LSN-014).
- Related LSN entries: `LSN-013-research-punted-on-substrate-draft.md` (sibling — research punt; same family of decision-pushing failures).
- Related auto-memory: `feedback_pause_and_ask_well.md`, `feedback_research_dont_punt.md`, `feedback_laser_focus_velocity.md`.
- Related playbook: `playbooks/pause-and-ask.md` (the rule that emerged).
