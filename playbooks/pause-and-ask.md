---
playbook: pause-and-ask
status: active
since: 2026-05-08
revision: 2 (research-backed; replaces intuition-authored revision 1; cites Anthropic Agent SDK docs + AskUserQuestion schema + gsd-build advisor pattern)
applies_to: universal (any phase about to ask the user a question)
---

# PROTOCOL pause-and-ask

When the agent must elicit a user decision, **use Claude Code's `AskUserQuestion` tool** — that is the canonical mechanism Anthropic ships for this purpose ([Agent SDK: Handle approvals and user input](https://code.claude.com/docs/en/agent-sdk/user-input)). Plain-text closers ("your call", "want me to...", multi-option open-enders inside narrative prose) are not the documented pattern — they bypass the structured-options flow that the Claude Code UI is designed to render and that maintainers know how to answer.

CLAUDE.md's "When to pause and ask the user" section names the **when**. This playbook is the **how** — calibrated to Anthropic's actual tool contract, not authored from intuition (the intuition-authored revision 1 of this playbook contradicted the schema in five places; see `retrospectives/LSN-015-intuition-authored-playbook.md`).

## trigger

Fire this protocol when **any** of the following holds:

1. The agent needs more direction on a task with multiple valid approaches and an answer would change the next action ([AskUserQuestion guide](https://www.atcyrus.com/stories/claude-code-ask-user-question-tool-guide)).
2. The agent is in plan mode, exploring the codebase, and wants to surface a design trade-off **before** finalising the plan — *"clarifying questions are especially common in plan mode"* ([Anthropic Agent SDK docs](https://code.claude.com/docs/en/agent-sdk/user-input)).
3. The agent is about to write any of the banned closers below (see `on-fail`).
4. The user pushes back with the form *"what answers should I answer?"* / *"what specifically do you need from me?"* — that is the explicit fire signal.

Do **not** fire when:

- The agent can proceed without a decision (workspace conventions or prior user authorisation cover the case).
- The "question" is research the agent should do (`playbooks/deep-research.md` fires instead — questions about toolchain, schema, granularity, format are research-tractable).
- The question is "Is my plan ready?" / "Should I proceed?" → use `ExitPlanMode` instead. AskUserQuestion in plan mode is for **design clarification before plan finalisation**, not plan approval ([Anthropic docs](https://code.claude.com/docs/en/agent-sdk/user-input)).
- The agent is a subagent spawned via `Agent` — `AskUserQuestion` is **not available** to subagents per Anthropic's documented limitations. Subagents must return findings to the orchestrator; the orchestrator decides whether to surface a question.

## inputs

- **The decision space.** What discrete options actually exist (not the agent's framing — the real, mutually-exclusive or multi-selectable choices).
- **Per-option context.** For each option, the trade-off / implication of choosing it (this becomes the option's `description` field in the schema).
- **The recommendation, if any.** The single best option to put first and label `(Recommended)`. If multiple options are conditional ("Rec if mobile-first"; "Rec if iteration-speed-critical"), use gsd-build's calibration tiers below — do not invent a forced single recommendation.

## procedure

### Step 1 — Choose the mechanism

Two valid mechanisms; pick by the answer's shape:

| Answer shape | Mechanism | When |
|---|---|---|
| Discrete options (the common case) | `AskUserQuestion` tool | The user is choosing among 2-4 options the agent can articulate from codebase/context analysis |
| Genuinely open-ended (rare) | Plain-text question in the agent's response | The user must supply free-form information that the agent can't enumerate (a name, a count, a custom path) |
| Approval / "should I do X?" | `ExitPlanMode` (in plan mode) or proceed and let the harness's permission flow handle tool approvals | Asking "should I proceed?" inside AskUserQuestion is documented as the wrong pattern |

**Default is `AskUserQuestion`.** If you find yourself drafting a plain-text multi-option question, that's the trigger to switch to `AskUserQuestion`.

### Step 2 — Format per the schema (1-4 questions, 2-4 options each)

Hard limits per Anthropic's schema and limitations docs ([Agent SDK](https://code.claude.com/docs/en/agent-sdk/user-input#limitations)): **1-4 questions per call, 2-4 options per question.** If you have more, you are punting research as questions — `playbooks/deep-research.md` fires.

Each `AskUserQuestion` call:

```jsonc
{
  "questions": [
    {
      "question": "Complete sentence ending with a question mark?",
      "header": "≤12 char chip",         // shown as a tag in the UI
      "options": [                        // 2-4 options
        { "label": "Recommended choice (Recommended)", "description": "Trade-off / implication" },
        { "label": "Alternative", "description": "When this fits better" }
      ],
      "multiSelect": false                // true if non-mutually-exclusive
    }
  ]
}
```

Schema rules ([source: tool description](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/tool-description-askuserquestion.md)):

| Field | Constraint |
|---|---|
| `question` | Complete sentence, ends with `?`. Specific. Avoid leading/loaded phrasing. |
| `header` | Max 12 characters. Examples: `Auth method`, `Library`, `Approach`. |
| `options` | 2-4 entries. Mutually exclusive unless `multiSelect: true`. |
| `options[].label` | 1-5 words. Concise display text. |
| `options[].description` | Trade-off / implication of this choice. The user reads this to disambiguate. |
| `options[].preview` | Optional. **Only** for visual artifacts (UI mockups, code snippets, diagrams) where side-by-side comparison helps. Single-select questions only. Skip for yes/no or text-only choices. |
| `multiSelect` | `true` for non-mutually-exclusive choices ("which features do you want to enable?"). |
| Recommended option | **First in array, `(Recommended)` suffix on label.** Do not signal recommendation any other way. |
| `Other` option | **Never include manually.** Anthropic's UI surfaces "Other" automatically with a free-text input. |

### Step 3 — Calibrate option count to decision maturity (gsd-build advisor pattern)

Adapted from [gsd-build's `gsd-advisor-researcher`](https://github.com/gsd-build/get-shit-done/blob/main/agents/gsd-advisor-researcher.md):

| Tier | Use when | Option count |
|---|---|---|
| `full_maturity` | The decision space is rich, prior art is plentiful, multiple options have legitimate use cases | 3-4 options |
| `standard` | A reasonable default exists but alternatives are worth surfacing | 2-3 options + recommendation conditional ("Rec if X") |
| `minimal_decisive` | One viable option dominates; alternative exists for completeness | 2 options, recommendation strong |
| **`single_viable`** | **Only one option is real** | **State it directly. Do NOT invent filler alternatives.** Skip AskUserQuestion entirely; ship the recommendation in narrative text and proceed. |

The single-viable tier is critical: padding 2 options with one filler degrades signal and trains the user to ignore options. If only one option is real, ship it.

### Step 4 — Write substantive questions, not obvious ones

From the published best-practices guidance ([SmartScope](https://smartscope.blog/en/generative-ai/claude/claude-code-askuserquestion-tool-guide/), [atcyrus.com](https://www.atcyrus.com/stories/claude-code-ask-user-question-tool-guide)):

> *"Don't ask obvious questions; ask questions that reveal hidden assumptions, expose edge cases the user hasn't considered, and uncover trade-offs they'll need to make."*

The agent's edge over a generic prompt is **codebase-aware option generation**. Use `Read`/`Grep`/`navigation/` lookups to enumerate options grounded in actual code, not generic alternatives. Bad: *"What database do you want?"* Good: *"This service uses Postgres for `metadata.*` and Redis for `cache.*`. The new `audit_log` table has access pattern X; should it live in Postgres (consistent with `metadata.*`, slower writes) or Redis (faster, no transactional join)?"*

### Step 5 — Workspace-specific framing addition: "what happens if you say nothing"

This is a workspace addition (not part of Anthropic's documented protocol) for context where AskUserQuestion is rendered as text in a CLI session: open the turn with a single sentence stating the default if the user does not respond. This makes silence a valid answer.

The default sentence does not replace `AskUserQuestion` — it precedes it. The agent's text output is: *"Default if you say nothing: \[specific action\]."* Then the `AskUserQuestion` tool call. Then end-of-turn.

## exit

- The agent has produced exactly one user-facing prompt this turn.
- The prompt uses `AskUserQuestion` for any discrete-option decisions (1-4 questions, 2-4 options each, recommended option first with `(Recommended)` suffix).
- Each option's `description` names the trade-off / implication of choosing it.
- Plain-text questions appear only for genuinely-open answers the agent cannot enumerate.
- The default-if-silent sentence (workspace addition) precedes the tool call.
- No banned closers anywhere in the turn (see on-fail).

## on-fail

**Banned closers** — rewrite or remove if any appear:

| Banned phrase | Why | Fix |
|---|---|---|
| *"Your call."* | Hides the actual decision | Use `AskUserQuestion` with the real options |
| *"Want me to X?"* | Hides what the user is approving | Ask the actual decision (e.g., "Adopt the ADR (which authorises MVP)?") |
| *"Let me know how to proceed."* | Punts framing onto the user | State the default; ask only the gating question |
| Multi-option open-ender in narrative ("adopt / defer / reject?") without an `AskUserQuestion` call | Bypasses the structured-options UI Anthropic ships | Use `AskUserQuestion` |
| *"Is my plan ready?"* / *"Should I proceed?"* in plan mode | Documented anti-pattern | Use `ExitPlanMode` for plan approval |

**Other failure conditions:**

- **More than 4 questions.** Hard limit per Anthropic's schema. If you have more, research is being punted as questions — `playbooks/deep-research.md` fires.
- **More than 4 options on a question.** Same hard limit. Collapse to top 4 by relevance; alternatives surface via `Other`.
- **Padding to reach option count.** If `single_viable` applies, ship the recommendation in narrative — do not invent filler.
- **Subagent context.** AskUserQuestion is unavailable in subagents (Anthropic limitation). Return findings to the orchestrator; the orchestrator decides whether to surface a question.
- **Cannot articulate per-option `description`.** Either (a) the option isn't a real distinct choice — collapse, or (b) the agent hasn't done the codebase analysis to know the trade-off — research first (`deep-research.md`).

## case-law

- `retrospectives/LSN-014-vague-interview-closers.md` — 2026-05-08 morning. Closing turns of the lineage-substrate session repeatedly used "your call" / "Want me to..." / multi-option open-enders. The original (revision 1) of this playbook was authored from intuition in response.
- `retrospectives/LSN-015-intuition-authored-playbook.md` — 2026-05-08 afternoon. Revision 1 of this playbook contradicted Anthropic's `AskUserQuestion` schema in five places (soft-cap-3 vs hard-cap-4; free-text answer vs labeled-options; recommendation-in-parens vs `(Recommended)`-suffix; "blast radius" not in the schema; "silence is fine" vs `Other` auto-escape). The user pushed back: *"please find in the internet how CC should do it!!! Look at the example of get shit done project does that!!!"* — a direct invocation of `playbooks/deep-research.md` that should have fired automatically when authoring this playbook from intuition. Revision 2 (this file) is research-backed.

## Sources

- **Anthropic Agent SDK — Handle approvals and user input** ([code.claude.com](https://code.claude.com/docs/en/agent-sdk/user-input)) — canonical guidance on the two user-input mechanisms (tool approval + AskUserQuestion); plan-mode caveats; subagent limitations.
- **AskUserQuestion tool description** ([Piebald-AI mirror of CC system prompts](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/tool-description-askuserquestion.md)) — the exact text Anthropic provides Claude Code about when/how to use the tool; the `(Recommended)` suffix rule; the auto-`Other` rule.
- **AskUserQuestion schema** (loaded directly via `ToolSearch`) — 1-4 questions / 2-4 options hard limits; field names and constraints; preview field semantics; multiSelect.
- **AskUserQuestion best-practices guides** ([SmartScope](https://smartscope.blog/en/generative-ai/claude/claude-code-askuserquestion-tool-guide/), [atcyrus.com](https://www.atcyrus.com/stories/claude-code-ask-user-question-tool-guide), [neonwatty.com](https://neonwatty.com/posts/interview-skills-claude-code/)) — "ask substantive questions, reveal hidden assumptions"; codebase-aware option generation as the agent's edge.
- **gsd-build advisor researcher pattern** ([github.com/gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done/blob/main/agents/gsd-advisor-researcher.md)) — option-count calibration tiers; "if only 1 viable option exists, state it directly"; conditional recommendations ("Rec if X") over rankings.
- Workspace-internal: `CLAUDE.md` "When to pause and ask the user" (the WHEN); `playbooks/deep-research.md` (sibling — fires when the question is research, not decision).
