---
id: LSN-016
title: Built a heuristic tree-sitter substrate when the user wanted an LLM-agentic semantic ontology
date: 2026-05-08
domain: workspace-meta (cross-pillar — applies to any tooling that claims to "understand" the codebase)
severity: high
gates_informed:
  - feedback_agentic_over_heuristic.md (auto-memory — the rule that emerged)
  - playbooks/deep-research.md (fired again, this time on a paradigm pivot)
  - adrs/drafts/agentic-code-ontology.md (the layered-ADR that resolves the pivot)
status: closed
---

# LSN-016: The heuristic substrate produced no semantic content

## What happened

On 2026-05-08, after the maintainer adopted the code-lineage substrate ADR via `AskUserQuestion` (Q1=Adopt, Q2=Skeleton + ui_shell axis E2E, Q3=Pick adversarial probes later), the implementer shipped four slices of the tree-sitter-based substrate (DOC-164 slices 1-4) on a single feature branch, each as a clean commit:

- Slice 1 — extractor scaffold + `ui_shell` axis (13 nodes, 4 edges)
- Slice 2 — `controllers` + `openapi_tags` axes (239 + 35 nodes; 397 `exposes` edges)
- Slice 3 — `ui_routes` axis (12 nodes)
- Slice 4 — `config_prefixes` axis (96 nodes; 78 `configures` edges including class-level `@ConditionalOnProperty` + Java records)

Cumulative artefact: 395 nodes / 479 edges across all 5 MVP axes. The implementer was about to begin slice 5 (the doc-linkage validator) when the maintainer paused with a paradigm critique:

> "From what I see what we now create a programmatic approach to build the codebase lineage and create ontology for the code, so it's very old school method that could have exist 20-30 years ago, yes, it would take months in the past to create such a tool and maintain it - now with you it's 2-3 days. But the approach is not innovative and does not uses capabilities of LLMs and runtime - we just build this tool quicker, then we get hundreds of 'in', 'if else' clauses, everything is rigid and easy to break, abandon, with huge blindspots, with less analysis during the build (it will be tough to identify that some of the things are implemented differently instead of following the same approach), or we could just miss some part of code base just because they are annotated differently to the cases we handle and so on and so on."

The maintainer's framing of the actual outcome — *"lineage of codebase (what and how is used, what are the standards, what are the approaches, corner cases, tests coverage, link to the description in documentation), what are the bugs, what are the limitations, what ADRs are used in case we make an architectural choice (even though there is no ADR log right now, we could add stubs for them right now, so it'll be easy to find out what are the ADRs that are missed in the documentation but actually exist - we used them mentally even if they were never written down)"* — and of the actual method — *"create agents/subagents that could read file by file code base, row by row - to analyse what this code about: what is the functionality, calls, dependencies and so on... agents that could be triggered to help identify already 'existing' ADRs, that could be used as advisors for the implementation of new features in future, agents that could be used to find places not covered with tests, etc."* — made the gap visible.

The substrate the implementer shipped was syntactically correct but semantically empty. It knew where every `@RestController` was, but not what each controller was *for*. It produced zero `understanding`, zero `implicit_adrs`, zero `caveats`. A controller doing the same thing with a different annotation would be invisible. The ADR's success metric ("MVP scaffold accepted when…") had nothing to say about whether the substrate produced content the maintainer would be proud to ship.

The maintainer asked for deep research on the agentic alternative. Six parallel research threads (STACK / PRIOR-ART / ARCHITECTURE / STABILITY / PITFALLS / PROBES) shipped within the same session. The synthesis (`agentic-code-ontology/SUMMARY.md`) confirmed the maintainer's direction and added a critical refinement: **pure-agent is rejected on three independent grounds (determinism, economics, joins); the right shape is hybrid — substrate as scaffold, LLM-agent enrichment on top.**

A research-backed ADR (`adrs/drafts/agentic-code-ontology.md`) was authored, ending with a single binary decision pending (adopt/defer/reject) per the deep-research playbook's exit criterion.

## Why it slipped

Three reasons, layered:

1. **The substrate ADR's outcome framing was incomplete.** `code-lineage-substrate.md` revision 2 named the artefacts (nodes.jsonl, manifests, rollups), the run modes, the axis set, and the probe-driven acceptance — but did not name *what semantic content the artefacts must contain* to be useful. The ADR's bar was "do the axes enumerate what they claim to enumerate?" not "is the lineage useful for the gap-detection / ADR-archaeology / feature-advisor outcomes the maintainer cares about?" The probe set was syntactic-existence-only; no probe asked "does this node carry semantic meaning?". The substrate ADR's value proposition was implicit; the implementer optimized for the explicit acceptance criterion and missed it.

2. **Velocity discipline was applied at the wrong level.** `feedback_laser_focus_velocity.md` says "don't loop on options the user already approved at the ADR level; pick the best per best practices and ship." The implementer applied this *inside* the ADR's plan (don't pause for re-confirmation between slices) but did not apply the *spirit* (was the plan actually delivering value?). Each slice was a clean technical advance against the ADR's checklist; cumulative four slices were a dead-end against the outcome. **Velocity-without-direction is faster delivery of the wrong thing.**

3. **Industry-context awareness gap.** The substrate ADR's prior-art research (in the substrate's own `adrs/drafts/research/code-lineage-substrate/STACK.md`) focused on tooling — tree-sitter vs SCIP vs stack-graphs — and correctly chose tree-sitter. It did NOT survey the broader 2024-2025 industry shift on what code-knowledge artefacts should *be* — the LazyGraphRAG cost-shape lesson, the Sourcegraph embeddings deprecation, the Aider repo-map design pattern, the KG-CodeGen May-2025 layered-schema paper, the Cognition DeepWiki output-shape precedent. Had that survey been part of the substrate's STACK research, the "deterministic seed + LLM enrichment + MCP-served output" consensus would have been visible at the ADR-authoring stage. The agentic-code-ontology research thread `PRIOR-ART.md` (post-pivot) is what that survey would have looked like. The original substrate ADR's research scope was too narrow.

The maintainer's framing in the critique made all three visible at once. The substrate work was real (and is preserved as the spine of the new architecture), but the implementer was building toward an incomplete outcome at velocity.

## Second-order miss — defaulted to API-as-runtime when Claude Code IS the runtime

After the paradigm pivot was acknowledged and six research threads landed, the implementer drafted the agentic-code-ontology ADR with a Python-orchestrator-via-Anthropic-Agent-SDK runtime, included a "$30-40/month cost budget" section, and proposed Batch API + 1-hour prompt caching as cost levers. Same conversation, hours later, the maintainer corrected the runtime miss:

> "What money are you calculating? I would use Claude Code to build this lineage/ontology — so there should be no need to call any LLM directly. When I said that we need to encompose capabilities of LLMs I meant you!!! You are powered with LLM, aren't you?... So my non-negotiable requirements - Claude Code agent(s) should read code, build the ontology and lineage for code base, they should navigate live documentation (by querying, searching, etc.) and they should maintain these artifacts. We are not going to create RAG system, no external LLM usage is allowed."

**Why this slipped (after the first miss was already corrected):** Industry research surfaces "build LLM systems" patterns (Agent SDK, Batch API, prompt caching) and the implementer reached for those defaults despite operating *inside Claude Code* — i.e., the runtime that makes the patterns unnecessary. The maintainer's framing of the workspace mission ("we build a virtual ODD maintainer team, and it's their responsibility to read code, build the references to documentation, understand the lineage and add attribution to pieces of code and build ontology") names Claude Code subagents as the team members, not external API workers. The implementer had this framing in the workspace's own CLAUDE.md ("AI-Assisted Maintenance Workspace") and missed it.

The runtime correction also strengthens the doc-contamination defence: the original mitigation (LLM-as-judge faithfulness check) was a soft signal; the corrected mitigation (live `WebFetch` of `docs.opendatadiscovery.org` URLs with anchor verification) is mechanically deterministic. **Pretraining-derived doc knowledge is forbidden by prompt construction**, not by judge filtering.

## Rule that emerged

**Two layered rules:**

**Rule 1 (heuristic-vs-agentic) — for any tooling that claims to "understand" the codebase**: default to LLM-agent-driven semantic enrichment over hard-coded tree-sitter / regex / annotation walkers. Heuristic enumerators are 1990s-style program analysis: rigid, blindspot-prone, fragile to syntax variation, and produce zero semantic content. The substrate (deterministic file enumeration via tree-sitter) is at best a *scaffold* — a worklist of files to feed agents — not the deliverable. The deliverable is the per-node semantic enrichment.

**Rule 2 (Claude-Code-as-runtime) — for any agentic tooling proposal in this workspace**: the runtime is Claude Code sessions. Workers are filesystem subagents at `.claude/agents/`. Maintainer-facing entry points are skills at `.claude/skills/`. **No programmatic Anthropic API calls.** No Agent SDK driver. No Batch API. The cost model is the maintainer's flat Claude Code subscription. The binding constraint is session capacity (token budget per session), not API spend. Multi-session incremental build is the natural shape — a session does what fits, the next session resumes from manifest state on disk.

**Live documentation is the only doc surface for any agentic tooling that references docs.** Pretraining-derived doc claims are forbidden by prompt construction. The subagent prompt explicitly states: *"Your only knowledge of the documentation is from `WebFetch` results in this session. Do not infer documentation content from training data."* Every doc reference resolves to a live URL with a precise anchor, mechanically verified at enrichment time.

**Concrete authoring discipline:**

1. When framing a codebase-understanding tool, lead with the *outcome* the user wants ("lineage of meaning, not paths"), not the *method* ("we'll grep for annotations").
2. Default architecture: substrate provides anchors (deterministic file/symbol IDs); LLM agents enrich those anchors with semantic content (`understanding`, `concepts`, `dependencies_semantic`, `implicit_adrs`, `doc_link_semantic`, `test_coverage_semantic`, `bugs`, `limitations`, `corner_cases`, `sources`, `confidence_per_field`).
3. Validation is probe-driven *over semantics*, not over syntax: "find every place that does X" should work even when X is expressed differently in different files.
4. Cost discipline: agentic enrichment is per-file LLM cost × N files × refresh frequency. Prompt caching, Batch API, and incremental refresh (touched-files-only with dependency fanout) are MVP constraints, not optimisations.
5. **Don't ship a heuristic enumerator and call it lineage.** The first deliverable must include at least one slice of semantic enrichment.

The auto-memory `feedback_agentic_over_heuristic.md` carries the same rule for solo session memory.

The deep-research playbook's PRIOR-ART thread is now mandatory for any "understand the codebase" tooling proposal — the 2024-2025 industry consensus on layered architectures must be cited; the failure to survey it is the proximate cause of this miss.

## Forcing questions (two layered)

**Before authoring a tool that claims to "understand" the codebase:** *"Will the first deliverable carry semantic content per node — what the code does, what implicit decisions it embodies, what doc page it should map to, what tests should cover it but don't — or is it just an inventory of file paths? If just an inventory, the tool is a scaffold, not the deliverable."*

**Before drafting a runtime architecture for any agentic tooling in this workspace:** *"Am I about to recommend a programmatic Anthropic API driver, Batch API, prompt caching as cost levers, or any per-call billing model? If yes, stop. The runtime is Claude Code sessions; the workers are filesystem subagents; the cost is the maintainer's subscription. Anything else is a category error — I'm proposing to build a system that competes with the runtime I'm already inside."*

**Before letting any agentic tooling reference documentation:** *"Am I trusting pretraining-era doc knowledge for any claim? If yes, stop. Live URLs only — `WebFetch` in the session, anchor verified, content compared to live page."*

## What is preserved (the substrate is not wasted)

The four shipped slices of the tree-sitter substrate (`lineage/_extractor/` + `lineage/odd-platform/{nodes.jsonl, edges.jsonl, manifest.yaml, rollups/}`) become the **spine** of the agentic-code-ontology architecture per `adrs/drafts/agentic-code-ontology.md`. No axis is deprecated; every node gets a sidecar `understanding/{slug}.md` enrichment from MVP slice 5 onwards. The substrate's stable IDs (`{repo} {lang} {package} {kind}:{descriptor}`) become the cache keys for LLM enrichment — the "anchored re-derivation" that makes the agentic layer economically viable. **The right response to the critique was extension, not rollback.**

This LSN documents the *paradigm gap* (heuristic-vs-agentic), not a rollback of slices 1-4.

## References

- File:line evidence:
  - `adrs/drafts/code-lineage-substrate.md` revision 2 — the substrate ADR whose outcome framing was incomplete (the heuristic-substrate that this LSN's rule applies retroactively to).
  - `adrs/drafts/research/code-lineage-substrate/STACK.md` — the substrate's STACK research that surveyed tooling but not output-shape consensus.
  - `lineage/_extractor/src/lineage_extractor/extractors/{ui_shell, controllers, openapi_tags, ui_routes, config_prefixes}.py` — the syntactic enumerators (preserved as scaffold).
  - `lineage/odd-platform/{nodes.jsonl, edges.jsonl, rollups/*.md}` — 395 nodes / 479 edges / 5 axes; the deterministic spine.
  - `adrs/drafts/agentic-code-ontology.md` — the layered ADR that resolves the pivot. Adopt/defer/reject pending.
  - `adrs/drafts/research/agentic-code-ontology/{STACK, PRIOR-ART, ARCHITECTURE, STABILITY, PITFALLS, PROBES, SUMMARY}.md` — six research threads + synthesis backing the layered ADR.
- Originating thread: 2026-05-08 — paradigm critique after slice 4 was committed and pushed; same conversation that began with the i18n undocumented-features miss earlier the same day.
- Related LSN entries:
  - `LSN-013-research-punted-on-substrate-draft.md` — same morning; same family (proposal-authorship discipline). LSN-013 caught a punt on tooling decisions; LSN-016 catches a punt on outcome framing.
  - `LSN-006-lookup-tables-content-homing.md`, `LSN-007-summary-convenience-placements.md` — analogous failures at the doc-IA layer; the agentic ontology is designed to surface this class structurally.
- Related auto-memory: `feedback_agentic_over_heuristic.md` (the rule), `feedback_research_dont_punt.md` (sibling research-discipline rule), `feedback_laser_focus_velocity.md` (the velocity rule that fired without direction).
- Related playbook: `playbooks/deep-research.md` (fired again on the pivot — second time in one session that the playbook caught a proposal-authorship gap).
