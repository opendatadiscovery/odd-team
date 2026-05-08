---
research: agentic-code-ontology
artifact: SUMMARY
date: 2026-05-08
mode: synthesis (parallel-researcher pattern, 6 threads)
overall_confidence: HIGH
threads: STACK + PRIOR-ART + ARCHITECTURE + STABILITY + PITFALLS + PROBES
revision: 2 (runtime corrected — Claude Code sessions + filesystem subagents + skills, not Anthropic API)
revision_2_drivers:
  - "maintainer non-negotiable: Claude Code is the runtime; no programmatic Anthropic API calls"
  - "maintainer non-negotiable: live documentation is the only doc surface; pretraining-derived doc claims forbidden by construction"
  - "maintainer non-negotiable: multi-session incremental build; session capacity is the binding constraint, not API spend"
  - "maintainer non-negotiable: virtual maintainer team built from filesystem subagents (.claude/agents/) read code, navigate live docs, build/maintain sidecars"
revision_1_errors_corrected:
  - "STACK.md proposed Claude Agent SDK Python driver — wrong runtime"
  - "STABILITY.md proposed Batch API + 1h prompt caching as cost levers — irrelevant under Claude Code subscription"
  - "PITFALLS.md P3 'Scale collapse' framed as $/file billing — replaced by 'session-budget collapse' (running out of context mid-batch)"
  - "PITFALLS.md P15 doc-contamination soft-mitigation (LLM-as-judge faithfulness) replaced by mechanical live-URL verification"
  - "Roadmap framed slice 5+ as autonomous batch — replaced by multi-session human-in-the-loop"
---

# SUMMARY — Synthesis & firm recommendations (revision 2)

This research fired in response to a 2026-05-08 paradigm critique: the four shipped slices of a tree-sitter-based code-lineage substrate (DOC-164 slices 1-4 — `lineage/_extractor/`, 395 nodes / 479 edges) were called out as 1990s-style syntactic enumeration. The maintainer asked for an LLM-agent-driven semantic ontology.

**Revision 1 of this synthesis got the architecture-above-the-runtime right (hybrid scaffold + LLM enrichment, per-node sidecars, six-agent set, ontology schema, six-type probe taxonomy) but defaulted to the wrong runtime — programmatic Anthropic Agent SDK with Batch API and prompt caching as cost levers.** The maintainer's clarification on 2026-05-08:

> "What money are you calculating? I would use Claude Code to build this lineage/ontology - so there should be no need to call any LLM directly. When I said that we need to encompose capabilities of LLMs I meant you!!! You are powered with LLM, aren't you?.. Second, I'm limited to the sessions capacity - it's fine, we could build the lineage in number of sessions, there is no constraint to finish in one go. Third, I so disagree that we could use LLMs training data for ODD documentation - it's nonsense and the ontology should have reference to live documentation with working and precise URLs and anchors so 'memory' does not work. What we should do - remember the main mission of the repo - we build a virtual ODD maintainer team, and it's their responsibility to read code, build the references to documentation, understand the lineage and add attribution to pieces of code and build ontology... So my non-negotiable requirements - Claude Code agent(s) should read code, build the ontology and lineage for code base, they should navigate live documentation (by querying, searching, etc.) and they should maintain these artifacts. We are not going to create RAG system, no external LLM usage is allowed."

Revision 2 below restates the synthesis with the corrected runtime. The architecture (hybrid, sidecars, schema, agents, probes) is unchanged; the operational layer (runtime, cost, refresh model, doc-handling) is new.

Six parallel research threads (STACK / PRIOR-ART / ARCHITECTURE / STABILITY / PITFALLS / PROBES) produced the original artefacts. Sibling artefacts STACK.md and STABILITY.md retain useful content but their toolchain / cost recommendations are superseded by this revision; PRIOR-ART, ARCHITECTURE, PITFALLS, PROBES carry forward largely intact.

## Key findings (cross-thread, revision 2)

1. **The pivot is correct in direction, but pure-agent is wrong.** The 2024-2025 industry consensus (Microsoft LazyGraphRAG, Sourcegraph deprecating embeddings, Aider's repo-map, Cognition DeepWiki, KG-CodeGen May-2025) is **deterministic structural seed + lazy LLM enrichment + maintainer-driven curation** — emphatically *not* "agent walks repo from scratch and emits everything." The substrate already shipped IS the structural seed; the pivot adds the semantic-enrichment layer on top. Pure-agent (let the agent decide what to analyse) is rejected on three independent grounds: determinism is load-bearing for an audit substrate, enumeration-as-LLM is uneconomic, and stable IDs are the join key for everything downstream. (HIGH — ARCHITECTURE.md "Hybrid vs pure-agent")

2. **The runtime is Claude Code, not Anthropic's API.** Maintainer non-negotiable, 2026-05-08: *"I would use Claude Code to build this lineage/ontology — so there should be no need to call any LLM directly... You are powered with LLM, aren't you?"* Workers are filesystem subagents at `.claude/agents/{file-analyser, doc-gap-finder, adr-archaeologist, test-coverage-mapper, concept-merger, feature-advisor}.md`. Maintainer-facing entry points are skills at `.claude/skills/{enrich, code-walk, find-implicit-adrs, doc-gap-check, ontology-status}/SKILL.md`. The Python `lineage/_extractor/` package retains its substrate role + grows read-only query helpers; it does NOT gain LLM-calling code. (HIGH — maintainer requirement; sub-agents docs; revision 1's STACK.md superseded.)

3. **Cost model is zero per-call.** The maintainer pays a flat Claude Code subscription. Per-call billing does not apply. The binding constraint is **session capacity** — how many tokens of context one session has, and how that translates into nodes-enriched-per-sitting. Multi-session incremental build is the natural shape: a session enriches what fits, commits the sidecars, ends; the next session reads the manifest and resumes against the new HEAD. The substrate's existing `last_enriched_commit` advances per session. Revision 1's "$30-40/month" was a category error. (HIGH — maintainer requirement; revision 1's STABILITY.md cost numbers superseded.)

4. **Doc-contamination defence is mechanical, not soft.** Maintainer non-negotiable: pretraining-derived doc claims are forbidden by construction. The subagent prompt explicitly states: *"Your only knowledge of the documentation is from `WebFetch` results in this session. Do not infer documentation content from training data."* Every `documents:` link in a sidecar is a live `https://docs.opendatadiscovery.org/...#anchor` URL, **WebFetch-verified at enrichment time** (200 status + anchor exists). Broken URLs / missing anchors become findings. The bidirectional doc-drift probe (Type 5) compares the live page content to the sidecar's `understanding` — both are present, both are current. **The substrate's success metric remains divergence-detection rate, not agreement rate**; revision 2 makes the verification mechanical (URL+anchor) rather than soft (LLM-as-judge faithfulness). (HIGH — maintainer requirement; revision 1's PITFALLS P15 mitigation strengthened.)

5. **Virtual maintainer team is the framing.** The mission of this workspace is "AI-assisted maintenance" — a virtual ODD maintainer team. Pre-LLM, maintainers built tribal knowledge mentally and on-the-fly: read code, infer purpose, remember caveats, link to docs from memory, recognise implicit ADRs by feel. This work was real but undocumented. Revision 2 reframes the agentic ontology as *that team's filing cabinet*: subagents are team members; their job is to externalise tribal knowledge into versioned, queryable, maintainable artefacts. Each subagent has a focused responsibility (file-analyser reads code; doc-gap-finder navigates live docs; adr-archaeologist surfaces implicit decisions). The maintainer is the team lead. (HIGH — maintainer framing.)

6. **Validation is sample-then-judge with six probe types — never bit determinism.** Anthropic's glossary states verbatim that even at `temperature=0` outputs are not bit-deterministic. Engineer for *semantic* stability. The substrate's existing PROBES protocol extends to a six-type taxonomy: existence / semantic-content / cross-axis / adversarial / doc-as-ground-truth / implicit-ADR. **Maintainer is the primary judge for MVP.** A peer-subagent LLM-as-judge can become a triage filter post-MVP if review backlog grows. Implicit-ADR validation remains maintainer-only (≥3/5 maintainer-written ADRs surface in top-10 ontology-claimed). (HIGH — PROBES.md.)

7. **The substrate already shipped is not wasted — it becomes the spine.** DOC-164 slices 1-4's tree-sitter extractor (395 nodes / 479 edges across 5 axes) is exactly the deterministic structural seed the literature calls for. Agentic enrichment is **additive**: each existing node gets a sidecar `understanding/{slug}.md`; no scaffold artefact is deprecated; no axis is removed. The hybrid architecture preserves every slice 1-4 deliverable as the *anchor layer* for everything that follows. (HIGH — ARCHITECTURE.md "Composition with existing 5-axis substrate")

## Confidence assessment (revision 2)

| Decision area | Confidence | Reasoning |
|---|---|---|
| Hybrid (substrate + enrichment) over pure-agent | HIGH | Three independent rejection grounds (determinism, economics, joins); industry consensus aligns; KG-CodeGen May-2025 paper validates the layered pattern directly |
| **Claude Code sessions as the runtime** | HIGH | Maintainer non-negotiable; aligns with the workspace's existing skill-driven workflow (`/scan`, `/implement`, `/review`); sub-agents docs document the exact filesystem-subagent + Agent-tool mechanism we use |
| **Filesystem subagents at `.claude/agents/`** | HIGH | Same — workspace pattern; subagent context isolation matches the per-file fresh-context discipline ARCHITECTURE.md requires |
| **Skills at `.claude/skills/` as entry points** | HIGH | Same — workspace pattern; skills are how the maintainer drives multi-step work today |
| **Live URL navigation via WebFetch as the only doc surface** | HIGH | Maintainer non-negotiable; mechanically stronger than revision 1's LLM-as-judge faithfulness check; eliminates the pretraining-contamination risk by construction |
| **Multi-session incremental build** | HIGH | Maintainer non-negotiable; matches the workspace's existing per-session work-unit model |
| One Markdown sidecar per ontology node | HIGH | Diffability invariant; proven by Aider's hierarchical-markdown output pattern; alternatives (inline JSONL, aggregated single-file) reject on diff-blast on refresh |
| Doc-contamination as #1 guardrail | HIGH | Direct threat to substrate's primary purpose; mechanically preventable via live-URL-only doc surface + claim-citation; LSN-001/002 case-law makes the threat concrete |
| Sample-then-judge MVP, maintainer-as-primary-judge | HIGH | Workspace pattern (`/review` is implementer-distinct session); LLM-as-judge as triage filter is post-MVP option |
| ≥85% sample faithfulness floor | MEDIUM | RAGAS reports this as a production threshold but ODD-specific calibration may shift; revisit after slice 5 |
| ≥3/5 implicit-ADR confirmation as block-gate | MEDIUM | The hardest-to-validate claim; threshold is the floor below which the implicit-ADR feature is unsupported, but precise number is judgment |
| Six-subagent set (file-analyser + 4 reducers + feature-advisor) | MEDIUM | The shape is right (map-reduce); the specific reducer count is tunable after slice 5 ships |
| `/scan --enrich` flag for per-PR incremental | MEDIUM | Natural extension of existing `/scan`; depends on session-budget capacity for the touched-files set |

**Removed from revision 1's confidence table** (the runtime corrections):
- ~~Claude Agent SDK as orchestration framework — HIGH~~ (rejected; not the right runtime)
- ~~1h prompt caching + Batch API stack — HIGH~~ (irrelevant; no API calls)
- ~~Pin model snapshots — HIGH~~ (irrelevant; the model is whatever Claude Code is running)
- ~~Per-PR incremental refresh, weekly+monthly full-rebuild — MEDIUM~~ (replaced by session-driven multi-session)

## Recommendations against the originating proposal's open decisions

The originating proposal (the user's 2026-05-08 critique) named a target outcome ("LLM-agent-driven semantic ontology") and a value proposition (lineage of meaning, agents as advisors, gap analysis as semantic divergence detection) without resolving the architectural choices. This synthesis converts every decision into a firm recommendation with confidence:

| # | Open decision | Recommendation | Confidence | Source thread |
|---|---|---|---|---|
| 1 | Pure-agent vs hybrid (substrate + LLM)? | **Hybrid.** Existing tree-sitter substrate (DOC-164 slices 1-4) becomes the agent worklist; LLM enrichment on top. | HIGH | ARCHITECTURE |
| 2 | Orchestration framework? | **Claude Agent SDK (Python) with programmatic `agents={...}`.** No LangGraph/CrewAI/AutoGen. | HIGH | STACK |
| 3 | Multi-agent topology? | **Orchestrator + N parallel general-purpose subagents per pass.** Two-level hierarchy ceiling (SDK constraint). 5-10 parallel workers/pass. | HIGH | STACK, ARCHITECTURE |
| 4 | Persistence shape? | **JSONL nodes + YAML manifest + per-node sidecar markdown** at `lineage/{repo}/understanding/{slug}.md`. Same shape as existing substrate. | HIGH | STACK, ARCHITECTURE |
| 5 | Cost-control levers? | **1h prompt caching + Batch API; discount-stack on full passes; sync API for `/scan` incremental.** Cheap-tier on Haiku where output quality permits. | HIGH | STACK, STABILITY |
| 6 | Refresh strategy? | **Per-PR incremental + weekly/monthly full-rebuild; quarterly mandatory full + adversarial probe round.** Touched-files dependency-fanout (1-hop graph walk). | HIGH | STABILITY |
| 7 | Determinism strategy? | **Anchor on substrate IDs (existing tree-sitter ID is the cache key); structured output via tool-use schema; pin model snapshots; 4-class diff review (schema-equal / paraphrase / claim-set drift / kind-axis drift). No consensus voting at MVP.** | HIGH | STABILITY |
| 8 | Ontology schema (per-node fields)? | **`understanding`, `concepts`, `dependencies_semantic`, `tests_coverage_semantic`, `docs_link_semantic`, `implicit_adrs`, `bugs_limitations_corner_cases`, `sources` (Gate 9), `confidence_per_field`.** YAML frontmatter + named Markdown sections. Validated by deterministic parser. | HIGH | ARCHITECTURE |
| 9 | Agent set? | **Six agents: `file-analyser` (per-node, MVP), four reducers (`concept-merger`, `doc-gap`, `adr-archaeologist`, `test-coverage-mapper`), and `feature-advisor` (query-time).** | HIGH (shape) / MEDIUM (count) | ARCHITECTURE |
| 10 | First-slice scope? | **`file-analyser` over 5 hand-picked nodes from existing scaffold. No reducers, no caching, no batch-mode. Maintainer reviews quality.** Concrete files: `AlertController.java`, `i18n.ts`, `application.yml#attachments`, `MinioConfig.java` (or substitute), one controller-method node. | HIGH | ARCHITECTURE |
| 11 | Validation framework? | **Sample-then-judge: 5% stratified sample (n=200), LLM-judge with 3-run averaging + Cohen's κ ≥0.6 against calibration set. Six probe types. Adversarial round per refresh. Implicit-ADR confirmation maintainer-only.** | HIGH (methodology) / MEDIUM (thresholds) | PROBES |
| 12 | Top-3 pitfalls to address in MVP? | **P15 (doc contamination), P4 (prompt injection from code), P3 (scale collapse).** Mitigations: code-anchor mandate; read-only-from-disk + structured-output-only tool surface; substrate-first + LLM-on-deltas + hard budget cap. | HIGH | PITFALLS |
| 13 | Files API / Memory tool? | **Reject Files API (no benefit, retention complexity); Memory tool out of scope for the deliverable, optional Phase 2 for orchestrator heuristics.** | HIGH | STACK |
| 14 | Fate of DOC-164 slices 1-4? | **Keep all 4 slices verbatim. The substrate scaffold is the spine; agentic enrichment is layered. No axis deprecated, no slice rolled back.** | HIGH | ARCHITECTURE |
| 15 | What does the deliverable look like? | **A queryable ontology surfaced via 3-tool MCP server (`ask_question`, `read_node`, `list_axis`) per DeepWiki precedent. Slice 1 ships the per-node enrichment + manual CLI; MCP is Phase 3.** | MEDIUM | PRIOR-ART, STACK |

### Revision 2 — runtime corrections (supersede rows above)

The maintainer's 2026-05-08 clarification supersedes rows 2, 5, 6, 11, 12, 13, 15 above. Use this revised table for the runtime layer:

| # | Decision | Revision-2 recommendation | Confidence |
|---|---|---|---|
| 2 | Runtime / orchestration | **Claude Code sessions.** Filesystem subagents at `.claude/agents/`. Skills at `.claude/skills/`. **No programmatic Agent SDK driver, no Batch API.** | HIGH |
| 5 | Cost / capacity model | **Zero per-call.** Claude Code subscription. Session capacity (token budget) is the binding constraint. | HIGH |
| 6 | Refresh strategy | **Session-driven, multi-session incremental.** `/scan --enrich` per PR; `/enrich --batch <axis>` for backfill; `/enrich <path>` for targeted work. Manifest's `last_enriched_commit` advances per session. | HIGH |
| 7-new | Doc handling | **Live URLs via WebFetch in the session.** Pretraining-derived doc claims forbidden by prompt construction. Every `documents:` link is `{url, anchor, last_verified_at, last_verified_status}`; URL+anchor verified mechanically; live-page content drives Type-5 drift probes. | HIGH |
| 11 | Validation framework | **Sample-then-judge with maintainer as primary judge for MVP.** LLM-as-judge as triage filter post-MVP if review backlog grows. Six probe types stand. Implicit-ADR confirmation maintainer-only. | HIGH (methodology) / MEDIUM (thresholds) |
| 12 | Top-3 MVP pitfalls | **P15 (doc contamination — mitigated mechanically via live-URL-only); P4 (prompt injection from code); P9 (context-window bleed within session — replaces P3 scale-collapse, which was a billing-framing artefact).** | HIGH |
| 13 | Files API / Memory | **Reject Files API.** Memory tool out of scope; the workspace's existing auto-memory at `~/.claude/projects/.../memory/` carries cross-session insights. | HIGH |
| 15 | Eventual surface | **Skills are the maintainer surface.** A future MCP server (slice 10+) for non-Claude-Code consumers; not on MVP path. | MEDIUM |

The architecture-above-runtime rows (1, 3, 4, 8, 9, 10, 14) are unchanged and stand verbatim. The revision-1 STACK.md and STABILITY.md research artefacts retain useful prior-art content but their toolchain / cost recommendations are superseded by this table.

## Roadmap implications

The substrate ADR's phase plan (`adrs/drafts/code-lineage-substrate.md` revision 2) is **not invalidated** — it becomes the *scaffold-track* of a wider plan. Slice numbering continues from where DOC-164 left off; agentic enrichment is **slice 5 onwards** in the existing tracking item.

Proposed slice progression (replacing the existing "slices 5-9" placeholder for what was the `doc-linkage validator` in DOC-164):

- **Slice 5 (this ADR's MVP — agentic enrichment introduction)** — `file-analyser` agent over 5 hand-picked nodes; manual CLI; maintainer reviews quality. Defines the per-node sidecar schema; validates the orchestrator-workers pattern; establishes the prompt cache / batch API plumbing.
- **Slice 6** — caching layer + batch-mode + the simplest reducer (`concept-merger`). Run against ~50 nodes. First sample-then-judge validation.
- **Slice 7** — `doc-gap` reducer. Output: first `doc-gaps.md` artefact with DOC-NNN candidates against the live `documentation/docs/SUMMARY.md`.
- **Slice 8** — `adr-archaeologist` reducer + `test-coverage-mapper` reducer. Implicit-ADR round (Type 6 probe). First adversarial round.
- **Slice 9** — `feature-advisor` query-time agent. Slice for `/code-walk <feature>` skill that returns a focused report citing ontology nodes.
- **Slice 10** — MCP server (3-tool surface per DeepWiki). Substrate consumable from outside the workspace.
- **Slice 11** — Bootstrap `@docs` annotation seed PR (~50-100 annotations, was originally substrate slice 6).
- **Slice 12** — Refactor `undocumented-features` scanner to query the ontology (was originally substrate slice 7).
- **Slice 13** — Navigation migration (was originally substrate slice 8).
- **Slice 14** — Full MVP probe round + ADR drafts/→adrs/ flip on full acceptance.

**Estimated cost shape across slices 5-14:** ~$30-40/month sustained operating cost; ~$200-300 one-time for slice 1-3 calibration runs. **Estimated maintainer time across slices 5-14:** comparable to slice 1-4 (each slice ~3-5 days of focused work), so 6-10 weeks total. The cost-shape projection is HIGH confidence; the time-shape is MEDIUM (depends on calibration roundtrips).

## Open questions deferred (genuine MVP-blockers only)

These are the genuinely-MVP-blocker questions. The synthesis resolved every other technical decision; these depend on first-pass empirical signal:

1. **What faithfulness threshold actually matches maintainer judgment?** Recommended ≥85% per RAGAS production guidance, but ODD's specific code/doc patterns may shift this. Resolve after slice 5's calibration set is graded by the maintainer (50-100 probes).
2. **Where does the cost-quality knee actually sit between Haiku and Sonnet?** Recommended Sonnet default, Haiku for routine summarization, Opus for implicit-ADR archaeology. Resolve by Probe 4 (cross-model drift check) after slice 6 ships.
3. **What's the right batch size for the orchestrator's per-pass dispatch?** Recommended 5-10 parallel workers per pass; tune empirically based on first-pass throughput + budget.
4. **Is per-node prompt caching sufficient, or do we need cross-node context?** A reducer that needs all per-node sidecars (e.g., `concept-merger`) may need the per-node JSON in its prompt; the cache strategy may need a separate cache breakpoint per reducer. Resolve in slice 6.

These are the ONLY questions left unresolved. Every technical decision (toolchain, schema, persistence, cost-strategy, validation methodology) is firm with HIGH or MEDIUM confidence and a cited source.

## Critical operating notes (for any maintainer reading this in 6 months)

- **DO NOT re-litigate the hybrid-vs-pure-agent decision.** The three rejection grounds for pure-agent are documented and load-bearing. If a future contributor proposes "let the agent enumerate," point them at ARCHITECTURE.md "Hybrid vs pure-agent" and the prior-art consensus in PRIOR-ART.md.
- **DO NOT skip the doc-contamination defence.** P15 is the substrate's killer-feature failure mode. Without code-anchor mandate + bidirectional doc-as-ground-truth probes, the substrate confirms the docs back to themselves and the LSN-001/002 incident class becomes structurally invisible.
- **DO NOT ship `understanding` claims without `sources`.** Gate 9 (factual provenance) applies. A claim without `evidence_file:line` + `evidence_excerpt` is unreviewable. The structured-output schema enforces this at parse time.
- **DO NOT use LLM-as-judge as the *primary* validation gate.** It's a triage filter, not a substitute for maintainer review. The 5% sample at every refresh is the floor; spot-checks below the threshold escalate to maintainer.
- **DO update this SUMMARY** if the slice 5+ work reveals contradictions with the research findings. The ADR is research-backed at the moment it ships; future findings may require a revision-2.
- **DO NOT create a new branch for slice 5 yet.** The DOC-164 tracking item still owns the work. The agentic-code-ontology ADR is the *plan*; DOC-164 is the *implementation tracking*. Slice 5 commits onto the substrate's working branch (or a new branch off main, per the workspace's branching convention) with a clear "DOC-164 slice 5 (agentic-code-ontology MVP)" title.
- **The substrate scaffold is not deprecated.** Tree-sitter extraction continues to be the deterministic enumerator. Anyone proposing to remove it is proposing to remove the spine. The scaffold's manifest, JSONL, edges, rollups — all stay.

## Sources

Each thread artefact has its own complete source list with inline markdown URLs. The cross-thread synthesis above cites the threads directly:

- [`STACK.md`](./STACK.md) — Anthropic SDK + Claude Code tool surface; orchestrator-workers pattern; persistence layer; prompt caching + Batch API; rejected alternatives (custom agent loop, filesystem subagents, skill-composition pipeline, agent teams, Files API, vector DB, SQLite, Memory tool)
- [`PRIOR-ART.md`](./PRIOR-ART.md) — Sourcegraph Cody, Cursor, Aider, GitHub Copilot, Cognition DeepWiki, Sweep, Bloop, Continue, Anthropic Skills, GraphRAG, LazyGraphRAG, CodexGraph, CGM, KG-CodeGen May-2025, Augment Code; consensus design (deterministic structural seed + lazy LLM enrichment + MCP-served output); what to adopt vs reject
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — hybrid vs pure-agent decision; ontology schema; six-agent set; storage layout; composition with existing 5-axis substrate; first-slice scope
- [`STABILITY.md`](./STABILITY.md) — determinism strategies; cost model with concrete dollar numbers; prompt caching strategy; drift detection; incremental refresh design; repeatability probe protocol
- [`PITFALLS.md`](./PITFALLS.md) — 15 named failure modes (P1-P15); top-3 ODD-specific risks; cross-cutting prevention themes; what we will NOT prevent (deliberate trade-offs)
- [`PROBES.md`](./PROBES.md) — six probe types; sample-then-judge MVP design; LLM-as-judge integration; adversarial round design; cross-validation against substrate's syntactic probes; concrete acceptance numbers
- [`agentic-code-ontology.md`](../../agentic-code-ontology.md) — the originating ADR (research-backed, this synthesis folded in)
- [`code-lineage-substrate.md`](../../code-lineage-substrate.md) — the substrate ADR this layer composes with
