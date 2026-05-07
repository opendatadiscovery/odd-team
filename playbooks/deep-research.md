---
playbook: deep-research
status: active
since: 2026-05-08
applies_to: universal (any phase that drafts an ADR, a pillar charter, a skill SKILL.md, a substantial proposal)
---

# PROTOCOL deep-research

When drafting a proposal that contains multiple technical decisions (toolchain, schema, granularity, format, sequencing, integration shape), do the research **in-band** and ship a research-backed opinionated draft. Do not list technical decisions as "open questions for human review" — that punts the maintainer's research onto the user and burns the very roundtrips this workspace's velocity bias exists to prevent.

The pattern this playbook codifies is gsd-build/get-shit-done's parallel-researcher methodology, adapted to this workspace's artefact conventions (`adrs/drafts/research/{slug}/`).

## trigger

Fire this protocol when **any** of the following holds and you are about to author a proposal:

1. The proposal makes ≥3 technical decisions you can't already justify from current workspace files (e.g., "which extractor toolchain", "what edge taxonomy", "what storage format").
2. You catch yourself drafting an "Open questions for human review" section that lists technical choices instead of true MVP-blocking unknowns.
3. The proposal touches a domain (code intelligence, indexing, lineage, schema design, multi-language tooling, etc.) where prior art exists in the broader ecosystem and our context-specific call depends on knowing the prior art.
4. **The proposal codifies external-system semantics** — tool schemas, SDK contracts, third-party API behaviour, named-tool constraints (`AskUserQuestion`, MCP tools, Edit, WebFetch, etc.). This includes playbooks that constrain agent behaviour around named tools, not just ADRs. Load the tool's schema or fetch the canonical doc; cite the field/constraint. "The tool supports up to 4 options" is a claim that traces to `schema.questions[].options.maxItems = 4`, not to the implementer's recollection. (See LSN-015 — intuition-authored `playbooks/pause-and-ask.md` revision 1 contradicted Anthropic's `AskUserQuestion` schema in five places.)
5. A user pushes back with the form *"Why are you relying on my review? Take an action for the research"* or *"please find in the internet how CC should do it"* — that is the explicit fire signal. (See `case-law` below.)

Do **not** fire for:
- Single-decision proposals where the call is one sentence ("which file does this paragraph belong in?").
- Proposals on workspace-internal conventions where the workspace itself is the authority (e.g., "should this go in `pillars/` or `playbooks/`?" — read CLAUDE.md, decide, ship).
- Time-boxed hot-path tasks where the user has explicitly said "ship the cheap fix now" — research can come after.

## inputs

- **The question(s) to answer.** State each as a decision, not a topic. ("Which extractor toolchain?" not "Toolchain options.")
- **The prior-art space.** Names of comparable tools, projects, or specifications you'd expect to find. If you don't know any, that's research thread #1.
- **The originating artefact.** The ADR / pillar / skill draft this research feeds. Research outputs fold back into it.
- **The slug.** Short identifier matching the originating artefact's filename stem (e.g., `code-lineage-substrate` → research dir `adrs/drafts/research/code-lineage-substrate/`).

## procedure

### Step 1 — Decompose into parallel research threads

Split the question set into 3-5 **focused, independently researchable** threads. The standard set (gsd-build's convention, adapted):

| Thread file | Scope | When to include |
|---|---|---|
| `STACK.md` | Toolchain selection — what tool/library does the work, what alternatives were rejected and why | Always, if any tool/library choice is in scope |
| `SCHEMA.md` | Data shape — granularity, node/edge taxonomy, identifier format, persistence format | When the proposal stores or transmits data |
| `DOC-LINKAGE.md` (or `INTEGRATION.md`) | Join keys with adjacent systems — how this proposal connects to docs, code, navigation, scanners | When the proposal must interoperate with existing artefacts |
| `PITFALLS.md` | Known failure modes from prior art + workspace-specific hazards | Always. The single most useful artefact when a future maintainer asks "why did we reject X?" |
| `PROBES.md` | Probe-driven validation: hand-picked test cases that exercise the proposal against arbitrary maintainer-known capabilities | When the proposal claims completeness/exhaustiveness over a domain (lineage, scanner enumeration, doc coverage) |
| `COMPARISON.md` | Side-by-side evaluation of named alternatives | When ≥2 named alternatives merit explicit ranking |
| `FEASIBILITY.md` | Achievability assessment under workspace constraints (single maintainer, OSS, no budget) | When the proposal is months-of-work and cost-shape matters |
| `SUMMARY.md` | Synthesis — firm recommendations with HIGH/MEDIUM/LOW confidence per decision; deferred genuine-MVP-blocker questions only | Always — the synthesizer artefact that the originating proposal cites |

Most ADRs need 4-6 threads. The minimum is `STACK + PITFALLS + SUMMARY`. `PROBES` is mandatory when claiming exhaustive coverage.

### Step 2 — Create the research directory

```
adrs/drafts/research/{slug}/
  STACK.md
  SCHEMA.md
  PITFALLS.md
  PROBES.md         # if exhaustiveness is claimed
  SUMMARY.md
```

For non-ADR research (pillar activation, skill design, framework changes), use `research/{slug}/` at workspace root or under the relevant pillar.

### Step 3 — Run research threads (parallel)

For each thread:

1. **Web research.** Use `WebSearch` for ecosystem discovery and `WebFetch` for authoritative-source extraction. Aggressively. Tools the maintainer should reach for in priority order:
   - Official docs (project README, spec files, RFC discussions)
   - Production-deployment evidence (industry shifts, archival announcements, version-2 RFCs that name the v1 mistakes)
   - Comparable workspaces with similar constraints
   - Prior-art repositories (read their ARCHITECTURE.md, their schema files)
2. **Local context.** Read the workspace files relevant to the thread. CLAUDE.md, retrospectives, existing playbooks, scanner manifests. The local context is the *scope constraint* the prior art must fit into.
3. **Write opinionated.** "Use X because Y, with HIGH confidence" — never "consider X, Y, Z." Each thread artefact must:
   - State the recommendation in the first 5 lines.
   - Cite sources inline (URLs as markdown hyperlinks).
   - Declare confidence: HIGH / MEDIUM / LOW per claim.
   - Name what was rejected and the reason for rejection (so future maintainers don't re-litigate).
   - Include an "Anti-recommendations" or "What we deliberately omit" section when temptation exists to include adjacent scope.

Run threads in parallel using parallel `WebFetch` / `WebSearch` calls. Tasks/TaskCreate to track progress when ≥3 threads are in flight.

### Step 4 — Synthesize into SUMMARY.md

Aggregate all thread recommendations into one synthesis artefact:

- **Key findings** (3-5 bullets) — the lessons that cut across threads.
- **Confidence assessment table** — one row per major decision area, HIGH/MEDIUM/LOW with reasoning.
- **Recommendations against the originating proposal's open decisions** — table mapping each open decision → firm recommendation → confidence → source thread.
- **Roadmap implications** — phase sequencing if the proposal is multi-phase.
- **Open questions deferred** — only the genuinely-MVP-blocker questions ("we'll know after the first axis ships"). Never technical decisions the synthesis could have resolved.
- **Critical operating notes** — what a maintainer reading this in 6 months needs to know about how to use these artefacts.

### Step 5 — Fold recommendations back into the originating proposal

Edit the originating ADR / pillar / skill:

1. **Replace** any "Open questions for human review" technical-decision list with a "Research-backed decisions" section citing the research dir.
2. **Add** confidence levels to each decision in the proposal.
3. **Reduce** the proposal's pending decision to a single binary call — adopt / defer / reject the proposal as a whole.
4. **Bump** the proposal's revision marker (e.g., `revision: 2 (research-backed)` in frontmatter).

### Step 6 — Log a retrospective if this protocol fired in response to a punt

If you fired this protocol because trigger condition #4 fired (the user pushed back), write or update an LSN retrospective. The retrospective is the case-law that this playbook cites; without it, the playbook is just text.

## exit

- Research dir contains all thread files + SUMMARY.md.
- Each thread file declares HIGH/MEDIUM/LOW confidence per recommendation, cites sources inline, names rejected alternatives.
- Originating proposal's "Open questions for human review" section is deleted or reduced to genuine MVP-blockers only.
- Originating proposal ends with a single binary decision pending (adopt/defer/reject), not a list of technical sub-questions.
- If trigger #4 fired: an LSN retrospective documents the punt as case-law.

## on-fail

- **Research surfaces contradictions between sources.** Raise to user explicitly with the contradiction stated; do not paper over with "looks like." This is the same factual-provenance discipline as Gate 9.
- **A thread can't be answered.** Mark the thread file's recommendation as **LOW confidence**, state what was tried, and write a "Decision deferred — context-specific judgment, revisit after MVP" note. Do not fabricate confidence.
- **Drafting more than 3 'open questions' at the end of a proposal.** Stop. This protocol fires on its own trigger #2 — ship a revised draft.
- **Time-boxed pressure.** If the user has explicitly said "ship now, research later," document the deferred research as a backlog item via `playbooks/follow-up-on-disk.md` and ship the cheap fix. The research playbook fires on the follow-up item, not on the hot path.

## case-law

- `retrospectives/LSN-013-research-punted-on-substrate-draft.md` — 2026-05-08 morning. Drafted `adrs/drafts/code-lineage-substrate.md` ending with eight "open questions for human review" listing technical decisions (extractor toolchain, granularity, edge taxonomy, storage format, navigation migration, MVP axis set, phase sequencing, parallel patch). User pushed back: *"Why are you relying on my review? Take an action for the research."* All eight were tractable via WebSearch + WebFetch + reading the workspace's own SUMMARY.md. The revision-2 of the ADR (research-backed) shipped within the same session, with five research artefacts in `adrs/drafts/research/code-lineage-substrate/`.
- `retrospectives/LSN-015-intuition-authored-playbook.md` — 2026-05-08 afternoon. Drafted `playbooks/pause-and-ask.md` revision 1 from intuition, contradicting Anthropic's `AskUserQuestion` schema in five places. User pushed back: *"please find in the internet how CC should do it!!! Look at the example of get shit done project does that!!!"* This LSN extended trigger condition #4 above (codifying external-system semantics → research-trigger). The same playbook caught the failure when applied properly: revision 2 (research-backed) cites the schema, the Anthropic Agent SDK docs, and gsd-build's advisor pattern.
- See also `feedback_research_dont_punt.md` (auto-memory), `feedback_pause_and_ask_well.md` (auto-memory — sibling rule for AskUserQuestion usage), `feedback_laser_focus_velocity.md` (auto-memory — closely-related velocity rules).
