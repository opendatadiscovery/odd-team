---
id: LSN-015
title: Authored pause-and-ask playbook from intuition instead of firing deep-research.md on it
date: 2026-05-08
domain: documentation (cross-pillar — applies to all proposal authoring)
severity: medium-high (meta-failure: the rule that should have caught this was authored in the same session)
gates_informed:
  - playbooks/deep-research.md (the rule that should have fired)
  - playbooks/pause-and-ask.md revision 2 (the corrected output)
  - feedback_research_dont_punt.md (auto-memory — applies to playbook authoring, not just ADR authoring)
status: closed
---

# LSN-015: Intuition-authored playbook contradicted Anthropic's documented schema

## What happened

On 2026-05-08, immediately after writing `playbooks/deep-research.md` (the rule that proposals with multiple technical decisions trigger parallel-researcher pattern with citations), the implementer authored `playbooks/pause-and-ask.md` revision 1 **from intuition** rather than from research. The playbook codified five claims that contradicted Anthropic's actual `AskUserQuestion` schema:

| Revision 1 claim (intuition) | Authoritative source |
|---|---|
| "Soft cap at 3 questions" | Hard cap 1-4 ([Anthropic Agent SDK docs](https://code.claude.com/docs/en/agent-sdk/user-input)) |
| "One-word/single-list answer shape" | 2-4 labeled discrete options + auto-`Other` for free-text ([schema](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/tool-description-askuserquestion.md)) |
| "Recommendation in parens" | `(Recommended)` suffix on first-position option (Anthropic tool description) |
| Per-question `blast radius` field | Not in the schema; not a documented concept |
| "Silence is fine" for non-blocking questions | `Other` is the documented escape; non-blocking questions should not be asked |

Revision 1 was, in effect, a hand-rolled alternative to a tool Anthropic already ships with documented contracts. The `AskUserQuestion` tool was loaded via `ToolSearch` earlier in the same session and was visible in the deferred-tool list throughout — but the implementer did not load its schema or read its description before authoring the playbook.

The user pushed back: *"I don't think the flow of inreview should look like that, just please find in the internet how CC should do it!!! Look at the example of get shit done project does that!!!"* — an explicit invocation of `playbooks/deep-research.md` for the playbook authoring itself.

Revision 2 (research-backed) was authored within the same session by:
1. Loading `AskUserQuestion`'s schema via `ToolSearch`.
2. Fetching Anthropic's Agent SDK user-input docs.
3. Fetching the canonical tool description (Piebald-AI mirror of Claude Code system prompts).
4. Searching for AskUserQuestion best-practices guides.
5. Fetching gsd-build's advisor-researcher agent for the option-calibration pattern.
6. Synthesising and citing inline in the playbook.

## Why it slipped

The miss is a meta-failure: the playbook that should have caught this (`deep-research.md`) had just been authored. The implementer recognised "this is a multi-decision proposal" for the lineage substrate (LSN-013) and applied the rule. The implementer did **not** recognise "this is a multi-decision proposal" for the pause-and-ask playbook itself — even though the playbook makes claims about specific tool semantics, schema fields, hard caps, and option formats. Each of those is a verifiable technical claim that prior art answers.

Two structural reasons:

1. **The implementer treated playbooks as "framework documentation" rather than "proposals with technical claims."** ADRs visibly contain technical decisions; playbooks read like prose. But a playbook that says "soft cap at 3 questions" is making a claim about Anthropic's tool contract — the same kind of factual claim that Gate 9 (`feedback_factual_provenance`) and `playbooks/claim-inventory.md` exist to catch. The implementer ran neither.

2. **`deep-research.md`'s trigger conditions did not name "authoring a playbook" explicitly.** Trigger condition #1 was "proposal makes ≥3 technical decisions you can't already justify from current workspace files." A playbook that codifies tool semantics counts; the implementer did not see it that way. Revision 2 of `deep-research.md` should add a note that playbooks codifying tool/SDK/external-system contracts are research-triggers, not just ADRs.

## Rule that emerged

`playbooks/pause-and-ask.md` revision 2 — the actual research-backed playbook.

**Generalised rule for `playbooks/deep-research.md` (extended scope):** any artefact that codifies external-system semantics — tool schemas, SDK contracts, third-party API behaviour — is a research-trigger. This includes playbooks that constrain agent behaviour around named tools (`AskUserQuestion`, `Edit`, `WebFetch`, MCP tools, etc.). Authoring such an artefact from intuition is the same failure class as drafting an ADR with "open questions for human review."

**Authoring discipline:** before claiming a tool's behaviour, load its schema (via `ToolSearch` or the SDK reference) and cite the field/constraint. "The tool supports up to 4 options" is a claim that traces to `schema.questions[].options.maxItems = 4`, not to the implementer's recollection.

## Forcing question

Before authoring any playbook, ADR, or pillar charter that names a tool, SDK, schema, or external-system contract: *"Have I loaded the tool's schema or fetched the canonical doc in this session? If not, I am authoring from memory and `playbooks/deep-research.md` fires."*

## References

- File:line evidence:
  - `playbooks/pause-and-ask.md` — revision 1 (intuition) was the file before this LSN; revision 2 (research-backed) replaced it in the same commit that adds this LSN.
  - `adrs/drafts/research/code-lineage-substrate/SUMMARY.md` — the gsd-build pattern this playbook should have followed from the start.
- Originating thread: 2026-05-08 conversation — second pushback round (after LSN-013 was already addressed).
- Related LSN entries:
  - `LSN-013-research-punted-on-substrate-draft.md` — same family; the original "research is the implementer's job, not the user's."
  - `LSN-014-vague-interview-closers.md` — the original miss this playbook was supposed to address.
- Related auto-memory: `feedback_research_dont_punt.md`, `feedback_pause_and_ask_well.md`, `feedback_factual_provenance.md`.
- Related playbook: `playbooks/deep-research.md` (the rule that should have fired but didn't).
- Authoritative external sources cited in the revision-2 playbook:
  - [Anthropic Agent SDK — Handle approvals and user input](https://code.claude.com/docs/en/agent-sdk/user-input)
  - [AskUserQuestion tool description (Piebald-AI mirror)](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/tool-description-askuserquestion.md)
  - [gsd-build/get-shit-done advisor researcher](https://github.com/gsd-build/get-shit-done/blob/main/agents/gsd-advisor-researcher.md)
