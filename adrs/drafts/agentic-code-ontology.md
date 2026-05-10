---
id: ADR-DRAFT-agentic-code-ontology
title: "Layer an LLM-agent-driven semantic ontology on top of the tree-sitter substrate, run by Claude Code virtual maintainers (DOC-164 slices 5+)"
status: accepted
date: 2026-05-08
mvp_shipped_date: 2026-05-09
mvp_accepted_date: 2026-05-10
revision: 2 (runtime corrected — Claude Code sessions + filesystem subagents + skills, not Anthropic API)
scope: workspace-meta (extends `code-lineage-substrate.md` revision 2 — does not supersede)
related_drafts: ADR-DRAFT-code-lineage-substrate
trigger_incident: 2026-05-08 paradigm critique — "we just built this tool quicker, but the approach is not innovative and does not use capabilities of LLMs and runtime"
runtime_correction: 2026-05-08 second pivot — maintainer clarified that Claude Code (not the Anthropic API) is the runtime; live documentation navigation (WebFetch on `docs.opendatadiscovery.org`) replaces any pretraining-derived doc knowledge; multi-session incremental build is the model
mvp_acceptance_note: 2026-05-10 — slice 9 shipped 2026-05-09; probe rounds (Types 2/3/4/5/6 + calibration) deferred to continuous validation per maintainer feedback ("we could always add ADRs afterwards, I don't have time"). See "MVP acceptance (2026-05-10)" section.
research_dir: adrs/drafts/research/agentic-code-ontology/ (STACK [revision-pending] / PRIOR-ART / ARCHITECTURE / STABILITY [revision-pending] / PITFALLS / PROBES / SUMMARY [revision 2])
research_methodology: gsd-build/get-shit-done parallel-researcher pattern (6 threads in parallel via Agent tool)
case_law: retrospectives/LSN-016-heuristic-substrate-no-semantic-content.md (paradigm pivot — heuristic vs agentic), revision 2 captures the runtime miss too
---

# ADR-DRAFT: Agentic Code Ontology (atop the tree-sitter substrate)

## Context

### The trigger

On 2026-05-08, after shipping four slices of the tree-sitter-based code-lineage substrate (DOC-164 slices 1-4 — `lineage/_extractor/`, 395 nodes / 479 edges across 5 axes), the maintainer delivered a paradigm critique:

> "From what I see what we now create a programmatic approach to build the codebase lineage and create ontology for the code, so it's very old school method that could have exist 20-30 years ago, yes, it would take months in the past to create such a tool and maintain it - now with you it's 2-3 days. But the approach is not innovative and does not uses capabilities of LLMs and runtime - we just build this tool quicker, then we get hundreds of 'in', 'if else' clauses, everything is rigid and easy to break, abandon, with huge blindspots, with less analysis during the build (it will be tough to identify that some of the things are implemented differently instead of following the same approach), or we could just miss some part of code base just because they are annotated differently to the cases we handle and so on and so on."

The critique's framing of the *outcome* the substrate should produce: "lineage of codebase (what and how is used, what are the standards, what are the approaches, corner cases, tests coverage, link to the description in documentation), what are the bugs, what are the limitations, what ADRs are used in case we make an architectural choice (even though there is no ADR log right now, we could add stubs for them right now, so it'll be easy to find out what are the ADRs that are missed in the documentation but actually exist - we used them mentally even if they were never written down)."

The critique's framing of the *method* Claude Code makes feasible: "create agents/subagents that could read file by file code base, row by row - to analyse what this code about: what is the functionality, calls, dependencies and so on... agents that could be triggered to help identify already 'existing' ADRs, that could be used as advisors for the implementation of new features in future, agents that could be used to find places not covered with tests, etc."

The substrate's tree-sitter implementation is syntactically correct but semantically empty. It knows where every `@RestController` lives but not what each controller is *for*. It cannot identify code that does the same thing with a different annotation. It produces zero `understanding`, zero `implicit_adrs`, zero `caveats`. The critique is correct.

### Why this is an architectural decision, not a tactical pivot

A tactical pivot would be "stop building tree-sitter axes, ship LLM-driven semantic enrichment." Three independent considerations make this a genuine architectural decision:

1. **The substrate is not wasted.** The 2024-2025 industry consensus (Microsoft LazyGraphRAG, Sourcegraph deprecating embeddings, KG-CodeGen May-2025 paper, Aider's repo-map) converges on **deterministic structural seed + lazy LLM enrichment + MCP-served output**. The substrate already shipped IS that structural seed. Discarding it would be the wrong response to the critique. (PRIOR-ART.md "Consensus design (2024-2025)")

2. **Pure-agent is rejected on three independent grounds.** Determinism is load-bearing for an audit substrate; enumeration-as-LLM is uneconomic; stable IDs are the join key for everything downstream (scanners, navigation, doc-linkage). Letting an agent decide what to analyse re-introduces the i18n-class blind spot in a different shape — now per-run stochastic instead of heuristic. (ARCHITECTURE.md "Hybrid vs pure-agent")

3. **The hybrid composes with the existing substrate, not against it.** Per ARCHITECTURE.md "Composition with existing 5-axis substrate": no axis is deprecated; every existing node gets a sidecar `understanding/{slug}.md`; the substrate's stable IDs become the cache keys for LLM enrichment. The four shipped slices remain valuable as the spine; agentic enrichment is layered.

This means the right response is **extension, not replacement**. The substrate ADR (`code-lineage-substrate.md` revision 2) stays valid; this ADR adds the agentic-enrichment layer on top.

### What the layer actually buys (and what it does NOT)

| Buys | Does not buy |
|---|---|
| **Semantic content per node** — `understanding`, `concepts`, `implicit_adrs`, `caveats`, `bugs_limitations_corner_cases`. The substrate's "where" gains a "what for". | **Replacement of the substrate.** Pure-agent enumeration is rejected. The deterministic scaffold is the spine. |
| **Cross-cutting reasoning** — `concept-merger` finds equivalent code with different syntax; `doc-gap` surfaces code-doc divergence; `adr-archaeologist` extracts implicit decisions across files. | **Bit determinism.** Anthropic's glossary states verbatim that even at `temperature=0` outputs are not bit-deterministic. We engineer for *semantic* stability. |
| **Implicit-ADR archaeology** — the "ADRs that exist mentally but were never written down" become surfaceable as candidates for explicit `adrs/` entries. | **Replacement of human review.** Sample-then-judge gates the floor; the maintainer remains the oracle for tacit knowledge (Type 6 probes). |
| **Code-doc divergence detection at scale** — every `understanding` field is bidirectionally faithfulness-checked against `documents:` link content. Mismatches become DOC-NNN candidates. | **Free operation.** Realistic budget is ~$30-40/month sustained; without prompt caching + Batch API the same shape is operating-cost-prohibitive. Cost levers are non-negotiable. |
| **Feature-impact reasoning** — given "I want to add X," the `feature-advisor` agent queries the ontology for affected concepts, implicit ADRs, related controllers, doc gaps. | **Reflection / runtime / generated code understanding.** Spring `@ConditionalOn*`, dynamic class loading, generated DTOs are documented blind spots; the substrate surfaces them as such, does not pretend to analyse them. |

### Why now, not later

The substrate slice 1-4 work delivered the deterministic seed. Slice 5 (originally the doc-linkage validator in DOC-164's tracking) is the natural place to introduce the agentic layer — the doc-linkage validator becomes the first reducer agent (`doc-gap`), and the per-node `file-analyser` agent is the prerequisite. Deferring would either (a) ship slice 5 as another tree-sitter axis (extending the critique-class) or (b) defer indefinitely. Neither is acceptable.

The cost ceiling is also new information. Anthropic's late-2025/early-2026 pricing — 1-hour prompt caching, Batch API discount stacking, pinned model snapshots — makes the agentic layer economically viable for a single-maintainer OSS project for the first time. (STABILITY.md "Cost model")

## Decision

**Extend the substrate with an LLM-agent-driven semantic ontology layer, persisted as one Markdown sidecar per ontology node, written by Claude Code subagents invoked from skills, anchored on the substrate's stable IDs, and built incrementally across sessions by a virtual maintainer team.**

**Runtime architecture — non-negotiable maintainer requirements:**

1. **Claude Code is the runtime.** All LLM work happens inside Claude Code sessions (interactive or autonomous-loop). No programmatic Anthropic API calls. No external SDK driver. The maintainer's Claude Code subscription is the cost model; per-call pricing is irrelevant.
2. **Subagents are the workers** — defined as `.claude/agents/{file-analyser, doc-gap-finder, adr-archaeologist, test-coverage-mapper, concept-merger, feature-advisor}.md`. Each subagent is a virtual maintainer team member with a focused responsibility. Spawned via the `Agent` tool from a session.
3. **Skills are the maintainer-facing entry points** — `.claude/skills/{enrich, code-walk, find-implicit-adrs, doc-gap-check, ontology-status}/SKILL.md`. Each skill orchestrates the relevant subagents over an input (a file path, a feature name, the full backlog).
4. **Live documentation is the only doc surface.** Subagents navigate `https://docs.opendatadiscovery.org/...#anchor` URLs via `WebFetch` at enrichment time. Pretraining-derived doc claims are forbidden — the prompt explicitly states "your knowledge of the docs is from `WebFetch` results in this session only; do not infer from training data." Every `documents:` link in a sidecar is a live URL with a verified anchor.
5. **Incremental, multi-session.** A session enriches N nodes (whatever fits in the session's context budget), commits the sidecars, ends. The next session reads the manifest, picks up where the last left off. No autonomous overnight batch; no all-at-once full repo pass. The substrate's existing `manifest.yaml` `last_enriched_commit` advances per session.
6. **Cost is zero per-call.** Token efficiency matters for context budget within a session, not for billing. Prompt-caching strategies are out of scope; session capacity is the constraint.

### Persisted artefact (extension to existing `lineage/{repo}/`)

```
.claude/
  agents/                                -- NEW: virtual maintainer team members
    file-analyser.md                     -- reads one node's source + walks neighbours; emits sidecar
    doc-gap-finder.md                    -- (slice 7) WebFetches doc pages; surfaces drift findings
    adr-archaeologist.md                 -- (slice 8) reads sidecars; surfaces implicit-ADR clusters
    test-coverage-mapper.md              -- (slice 8) reads sidecars + test files; emits behaviour map
    concept-merger.md                    -- (slice 6) reads sidecars; finds concept equivalences
    feature-advisor.md                   -- (slice 9) query-time advisor over the full ontology
  skills/                                -- NEW: maintainer-facing entry points (extend existing skills)
    enrich/                              -- /enrich [<path> | --touched | --full]
      SKILL.md
    code-walk/                           -- /code-walk <feature> — feature-advisor query-time
      SKILL.md
    find-implicit-adrs/                  -- /find-implicit-adrs — runs adr-archaeologist
      SKILL.md
    doc-gap-check/                       -- /doc-gap-check — runs doc-gap-finder
      SKILL.md
    ontology-status/                     -- /ontology-status — coverage + staleness report
      SKILL.md

lineage/
  README.md                              -- existing (extended with skill + subagent pointers)
  PROBES.md                              -- existing (extended for semantic claims per PROBES.md research)
  _extractor/                            -- existing tree-sitter scaffold (slices 1-4 shipped)
    src/lineage_extractor/
      cli.py                             -- existing; gains read-only `query` + `coverage` subcommands
                                         --   for skill-shell-out (no `enrich` subcommand — Claude
                                         --   Code subagents do the enriching, not the Python CLI)
      extractors/                        -- existing per-axis extractors (unchanged)
      rollups/                           -- existing structural rollups (unchanged)
      ontology_query.py                  -- NEW: deterministic helpers used by skills
                                         --   (read sidecar, list stale nodes, validate schema, etc.)
                                         --   No LLM calls — pure file I/O for skill plumbing.
      validators.py                      -- NEW: parser for the sidecar schema (frontmatter + sections)
  odd-platform/
    manifest.yaml                        -- existing; add `enrichment` block (last_enriched_commit, etc.)
    nodes.jsonl                          -- existing; unchanged
    edges.jsonl                          -- existing; unchanged
    rollups/                             -- existing structural rollups (unchanged)
    understanding/                       -- NEW: per-node enrichment, one file per node
      odd-platform__java__controller__AlertController.md
      odd-platform__ts__locales__bootstrap__i18n.md
      ...
    concepts.yaml                        -- NEW (slice 6): concept-merger output
    doc-gaps.md                          -- NEW (slice 7): doc-gap output (DOC-NNN candidates)
    implicit-adrs.md                     -- NEW (slice 8): adr-archaeologist output
    test-map.yaml                        -- NEW (slice 8): test-coverage-mapper output
    enrichment.log                       -- NEW: per-session audit log (session id, nodes touched,
                                         --   subagents invoked, doc URLs fetched + status)
```

The Python `lineage/_extractor/` package keeps its existing role (tree-sitter scaffold + read-only query helpers) and **does not gain LLM-calling code**. The enrichment work happens entirely in Claude Code: subagents read files, call `WebFetch`, write sidecars via the `Write` tool. The Python side parses + validates + queries.

### Per-node enrichment file shape (`understanding/{node-id-slug}.md`)

```markdown
---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.controller controller:AlertController"
node_kind: controller
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.1.0
model: claude-sonnet-4-6
enrichment_status: complete
confidence_overall: HIGH
---

# AlertController — semantic understanding

## understanding
2-4 sentences in plain English: what this code does, what business behaviour it
represents, how it fits into the surrounding feature.

## concepts
- entities: [Alert, AlertChannel, AlertConfig, DataEntity]
- operations: [list-alerts, change-alert-status, configure-alert-recipients]
- invariants: [alert ownership inherited from data-entity ownership]
- audiences: [data-platform-operator, data-entity-owner]

## dependencies_semantic
- requires-feature: data-entity-ownership
- requires-config: notifications.* (channel routing)
- requires-runtime: spring-security context (filters by current user)

## tests_coverage_semantic
- covered_behaviours: [list, status-change]
- uncovered_behaviours: [recipient-config, escalation, snooze]
- test_files: [AlertControllerTest.java#testListAlerts, ...]

## docs_link_semantic
- declared_docs: [features/alerts/overview]
- inferred_docs: [features/alerts/configuration]
- doc_drift_findings: [...]

## implicit_adrs
- "Alert visibility is filtered at controller layer, not at repository layer.
   A service-layer caller bypassing the controller would see all alerts."

## bugs_limitations_corner_cases
- "On 10K+ alerts, list endpoint returns full set without pagination"

## sources
- understanding ← AlertController.java:1-95
- implicit_adrs.[0] ← AlertController.java:34 (@PreAuthorize)
- bugs_limitations.[0] ← AlertController.java:51 (no Pageable param)

## confidence_per_field
- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: MEDIUM (runtime-deps inferred)
- tests_coverage_semantic: HIGH (file-grep verified)
- docs_link_semantic: MEDIUM (inferred_docs is agent suggestion)
- implicit_adrs: MEDIUM (decisions inferred, not stated)
- bugs_limitations_corner_cases: HIGH (verified by file read)
```

The schema is YAML frontmatter + named Markdown sections. Validated by `validators.py` — a section that fails to parse logs a follow-up; it does not silently fall back. Hand-edits the maintainer makes survive future enrichment passes (orchestrator preserves any `## Maintainer notes` block verbatim).

### Manifest extension

```yaml
enrichment:
  schema_version: 0.1.0
  subagent_versions:
    file-analyser: file-analyser/0.1.0
    {others as they ship}
  last_enriched_commit: ede5d277
  enriched_node_count: 47
  total_node_count: 395
  enrichment_coverage: 11.9%
  last_session_id: 2026-05-08T15:30Z       # Claude Code session that last advanced the manifest
  doc_url_health:
    last_full_check: 2026-05-08
    broken_count: 3                          # WebFetch verification — broken URLs surface as findings
```

No `total_cost_usd` field. No `models_used` field — the model is whatever Claude Code is running. No `cache_hit_rate` — caching is per-session implicit, not a billing concept.

### Skill entry points (the maintainer surface)

| Skill | Behaviour | Subagents invoked |
|---|---|---|
| `/enrich <path>` | Single-file enrichment. Subagent reads the file, walks 1-hop neighbours, WebFetches any pre-existing `documents:` URL, emits the sidecar. Maintainer can review and revise inline. | `file-analyser` |
| `/enrich --touched` | Reads manifest's `last_enriched_commit`, computes git-diff vs HEAD, picks N touched files (where N fits the session budget), enriches them, advances the mark. | `file-analyser` |
| `/enrich --batch <axis>` | Pick the next N unenriched (or stale) nodes from a given axis. | `file-analyser` |
| `/find-implicit-adrs` | Reads all sidecars' `implicit_adrs` blocks; clusters; emits `implicit-adrs.md`. | `adr-archaeologist` |
| `/doc-gap-check [<page>]` | Walks every sidecar's `documents:` link via `WebFetch`; verifies live URL + anchor; runs Type-5 bidirectional drift probe; emits `doc-gaps.md`. | `doc-gap-finder` |
| `/code-walk <feature>` | Query-time. Maintainer asks "I want to add X — what's affected?" Subagent reads ontology, returns focused report. | `feature-advisor` |
| `/ontology-status` | Coverage + staleness + broken-doc-URL report. Pure read; no subagent. | (none — Python helper) |

`/scan` (existing skill) gains a `--enrich` flag that runs `/enrich --touched` after a tree-sitter rebuild — making per-PR incremental enrichment a one-command flow.

### Multi-session continuation contract

A session enriches whatever fits its context budget — could be 5 nodes, could be 50, depends on file sizes and reducer scope. At session end:

1. All produced sidecars are committed (or staged) to `lineage/{repo}/understanding/`.
2. `manifest.yaml` `last_enriched_commit` advances IFF the session completed a clean batch (no partial writes).
3. `enrichment.log` records the session id, the nodes touched, the subagents invoked, the doc URLs fetched.

The next session starts cold; it reads `manifest.yaml` and resumes against the new HEAD or the last anchor. **No state-passing between sessions other than the on-disk artefacts.** This is the same model as `/scan` and `/implement` already use — sessions are units of work; the workspace's filesystem is the cross-session memory.

### Research-backed decisions (revision 2 — runtime corrected)

Full rationale + sources lives in [`adrs/drafts/research/agentic-code-ontology/SUMMARY.md`](research/agentic-code-ontology/SUMMARY.md) revision 2. Compressed table reflecting the Claude-Code runtime:

| # | Decision | Recommendation | Confidence | Source |
|---|---|---|---|---|
| 1 | Pure-agent vs hybrid | **Hybrid.** Substrate is the worklist. | HIGH | ARCHITECTURE |
| 2 | Runtime | **Claude Code sessions.** Filesystem subagents under `.claude/agents/`. Skills under `.claude/skills/`. **No programmatic Anthropic API, no Agent SDK driver, no Batch API.** | HIGH | maintainer non-negotiable + sub-agents docs |
| 3 | Worker shape | **One filesystem subagent per role** (file-analyser, doc-gap-finder, adr-archaeologist, test-coverage-mapper, concept-merger, feature-advisor). Spawned via the `Agent` tool from a session. | HIGH | sub-agents docs; ARCHITECTURE |
| 4 | Persistence shape | **JSONL nodes (existing) + YAML manifest (existing) + per-node sidecar Markdown** under `lineage/{repo}/understanding/{slug}.md`. | HIGH | ARCHITECTURE |
| 5 | Cost model | **Zero per-call.** Claude Code subscription. Session capacity is the binding constraint, not API spend. | HIGH | maintainer non-negotiable |
| 6 | Refresh strategy | **Session-driven, multi-session incremental.** `/enrich --touched` per `/scan`; `/enrich --batch <axis>` for backfilling; `/scan --enrich` ties it to the existing scan flow. No autonomous batch. | HIGH | maintainer non-negotiable; STABILITY (incremental design) |
| 7 | Determinism | Anchor on substrate IDs; structured Markdown sidecar schema (validated by `validators.py`); 4-class diff-review (schema-equal / paraphrase / claim-set drift / kind-axis drift). | HIGH | STABILITY |
| 8 | Ontology schema | YAML frontmatter + 8 named Markdown sections. Validated deterministically. | HIGH | ARCHITECTURE |
| 9 | Agent set | **6 subagents** as above. | HIGH (shape) / MEDIUM (count) | ARCHITECTURE |
| 10 | First-slice scope | **`/enrich` skill + `file-analyser` subagent + 5 hand-picked nodes from existing scaffold.** Maintainer runs `/enrich <path>` 5 times in one session, reviews quality. No reducers. | HIGH | ARCHITECTURE |
| 11 | Validation | **Sample-then-judge** with the maintainer as the primary judge for MVP. LLM-as-judge (a peer subagent) becomes a triage filter post-MVP if review backlog grows. Six probe types. ≥3/5 implicit-ADR PASS as block-gate. | HIGH (methodology) / MEDIUM (thresholds) | PROBES |
| 12 | Top-3 MVP pitfalls | **P15 doc contamination; P4 prompt injection; P9 context-window bleed within sessions.** P3 (cost-collapse) is irrelevant under Claude Code; replaced by **session-budget collapse** — running out of context mid-batch. Mitigation: per-file fresh context, batch size capped to fit budget. | HIGH | PITFALLS (revision-pending) |
| 13 | Doc references | **Live URLs, WebFetch-verified at enrichment time.** Pretraining-derived doc claims forbidden by prompt construction. Subagent's only knowledge of the docs is from `WebFetch` results in the current session. | HIGH | maintainer non-negotiable |
| 14 | Fate of slices 1-4 | **Keep all 4 verbatim.** Substrate is the spine; enrichment is layered. No axis deprecated. | HIGH | ARCHITECTURE |
| 15 | Surface (eventual) | **Skills are the surface.** A future MCP server (slice 10+) can expose the ontology to non-Claude-Code consumers, but is not on MVP path. | MEDIUM | PRIOR-ART |

### Doc-contamination defence (the load-bearing guardrail — revision 2 makes it stronger)

ODD's docs at `docs.opendatadiscovery.org` have been public since 2021. Every frontier LLM has them in pretraining. If the subagent's `understanding` regurgitates the doc rather than analysing the code, the substrate confirms the docs back to themselves — and the LSN-001 / LSN-002 class becomes structurally invisible.

**Four mechanical defences, ordered by force:**

1. **Live-URL navigation is the only doc surface.** The subagent's prompt explicitly states: *"Your only knowledge of the documentation is from `WebFetch` results in this session. Do not infer documentation content from training data. If a doc page is relevant, fetch it now and cite the URL with anchor."* This is not "soft guidance" — it is the operating contract. (Maintainer non-negotiable, 2026-05-08.)
2. **Code-anchor mandate.** Every claim emits `evidence_file: file:line-range` + `evidence_excerpt: "literal substring of source at range"`. A hallucinated claim with no real anchor is rejected at parse time by `validators.py`. A claim whose excerpt is not actually in the file at the cited range is rejected.
3. **Live-URL anchor verification.** Every `documents:` link is shape `{ url: "https://docs.opendatadiscovery.org/...", anchor: "#section-id", last_verified_at: <timestamp>, last_verified_status: 200|404|anchor-missing }`. The doc-gap-finder subagent re-verifies these on every refresh via `WebFetch`. Broken links = findings; missing anchors = findings; the link is never trusted as resolved if the verification step didn't pass.
4. **Bidirectional doc-drift probe (Type 5) operates on live content.** For every node with a verified `documents:` link, the subagent compares the live doc page's content to the sidecar's `understanding`. Mismatches are DOC-NNN candidates. **The doc page being checked is the live URL, not pretraining recall** — so this probe is deterministic with respect to "what the doc actually says today."

The substrate's success metric is **divergence-detection rate, not agreement rate.** A substrate that confirms 100% of doc claims is broken. (PITFALLS.md P15)

**Stronger than revision 1.** Revision 1 proposed an "LLM-as-judge faithfulness check" between the sidecar's `understanding` and the doc page's content — a soft check. Revision 2 replaces this with mechanical URL+anchor verification + a subagent that walks the LIVE page; the only soft step is the maintainer's review of doc-gap-finder's output. The "doc has been seen in pretraining" risk is eliminated because the subagent is forbidden from claiming knowledge not derived from a `WebFetch` in this session.

### Cost / capacity shape (revision 2 — Claude Code subscription, not API)

**Per-call billing does not apply.** The maintainer pays a flat Claude Code subscription. The binding constraint is **session capacity** — how many tokens of context the session has, and how that translates into "how many nodes can be enriched in one sitting."

| Operation | Binding constraint | Approximate scope per session |
|---|---|---|
| `/enrich <single file>` | A few % of session budget per file | One file at a time; trivial |
| `/enrich --touched` after a small PR | Session budget shared across the touched set | 5-20 nodes per session realistically |
| `/enrich --batch <axis>` (back-fill) | Session budget; subagent context fresh per file | 10-50 nodes per session, depending on file size |
| `/find-implicit-adrs` (reducer over all sidecars) | Reducer reads N sidecars at once; budget caps N | First-pass on subset; converge over multiple sessions |
| Full repo enrichment | Multi-session by construction | Spread across N sessions; manifest tracks progress |

**Multi-session is the natural shape.** A session does what fits, commits the sidecars, ends. The next session reads the manifest, picks up where the last left off. The substrate's `last_enriched_commit` advances per session. There is no all-at-once "full rebuild"; there is a manifest that progressively becomes complete and is then maintained against drift.

**Token efficiency still matters within a session.** A subagent that reads 50K tokens of irrelevant context wastes session budget. Mitigations:
- Per-file fresh subagent context (no batching across unrelated files).
- The orchestrating session passes only the node ID + relevant scaffold edges to the subagent prompt; the subagent fetches the file itself.
- Prompt cache hits within a session are implicit (the model optimises this); we don't engineer for it explicitly.

**No money is calculated.** Revision 1's "$30-40/month" was a category error.

### MVP acceptance — probe-driven validation

Per the substrate's existing PROBES discipline, the MVP semantic ontology is accepted when **all** the following hold (full protocol in PROBES.md):

| Check | Threshold |
|---|---|
| All 12 substrate seed probes PASS (existence-of-capability) | inherited from substrate MVP |
| Sample faithfulness (Type 2 across stratified n=200) | ≥85% correct |
| Cross-axis joins (Type 3 across 5 invariants) | ≥4/5 hold; sampled positives ≥80% true |
| Doc-as-ground-truth (Type 5 bidirectional) | ≥85% faithfulness or LLM-judge `correct` |
| Adversarial PASS (Type 4) | ≥2/3 maintainer-authored capability-negation probes return empty/null |
| Implicit-ADR confirmation (Type 6) | ≥3/5 maintainer-written ADRs surface in top-10 ontology-claimed |
| Calibration agreement (LLM-judge vs maintainer on 50-100 set) | Cohen's κ ≥ 0.6 |
| Fabricated-node count (Type 4 CRITICAL FAIL) | 0/N |

Each FAIL is classified — axis-gap / extractor-bug / annotation-gap / hallucination / drift / tacit-gap — and routed via `playbooks/follow-up-on-disk.md`.

## Consequences

### What becomes easier

- **The substrate's `nodes.jsonl` becomes a worklist.** Every node is a candidate for enrichment; the agentic layer processes the queue. The substrate's existing CLI (`scan`, `--full`, `--dry-run`, `--ref`) gains an `enrich` subcommand mirroring the same modes.
- **The "ADRs that exist mentally" become surfaceable.** `adr-archaeologist` reads per-node `implicit_adrs` blocks across all sidecars, clusters by similarity, surfaces top-N candidates. Maintainer triages each into either a stub `adrs/{slug}.md` or a deferred-list. This directly addresses the maintainer's framing of the outcome.
- **Doc-gap analysis becomes semantic.** `doc-gap` reducer runs faithfulness checks on every `documents:` link; mismatches become DOC-NNN candidates. The current `undocumented-features` scanner can eventually query the ontology instead of running its own enumeration (slice 12).
- **Test coverage becomes a behaviour-mapping, not a file-count.** `test-coverage-mapper` reducer reads `tests_coverage_semantic` blocks across nodes and surfaces *behaviours* without tests, not just files without tests.
- **Feature-impact reasoning becomes possible.** `feature-advisor` (slice 9): given "I want to add X," queries the ontology for affected concepts, implicit ADRs, related controllers, doc gaps. The substrate becomes a planning aid, not just an audit artefact.
- **Cross-language equivalence detection becomes possible.** `concept-merger` reducer finds the Java `IngestionService` and the Python `BaseAdapter.ingest()` belong to the same `data-ingestion` concept. The closed vocabulary (per `docs/main-concepts.md`) anchors the equivalence.

### What becomes harder

- **A new artefact class to keep correct.** Per-node sidecars + reducer outputs. Mitigations: schema-locked extraction (validators reject non-conforming output); cache-keyed by `(node_id, scaffold_hash, prompt_version, model)` so unchanged input is bitwise-stable; per-node version stamps so drift is attributable.
- **Per-call LLM cost.** Even with caching+batching, sustained cost is non-zero. Mitigations: hard budget cap; tier-based refresh (hot/warm/cold axes); cheap-tier on Haiku where output quality permits.
- **Stochasticity of LLM outputs.** Anthropic explicit: temperature=0 ≠ bit determinism. Mitigations: anchor on substrate IDs (cache key); structured tool-use schema (collapses generation surface); 4-class diff-review (schema-equal vs paraphrase vs claim-drift vs kind-drift).
- **Doc-contamination risk (P15).** ODD docs are in pretraining. Mitigations: doc text never in agent context during code-walk; code-anchor mandate; bidirectional doc-drift probes.
- **Validation overhead.** Sample-then-judge is the default; LLM-judge bias is documented (position, length, self-preference). Mitigations: cross-family judge (Sonnet authors, Haiku judges or vice versa); calibration set with maintainer grading; Cohen's κ floor.
- **Maintenance contract.** The orchestrator + 6 agents + reducer outputs. For a single-maintainer OSS project, this is real. Mitigations: each slice is independently shippable + reviewable; the substrate continues to work without enrichment (just with empty `understanding/` blocks).

### Cost shape (slice budget)

- **MVP slice 5** (this ADR's first slice — `file-analyser` over 5 nodes): ~3-5 days of work; ~$5-20 in LLM spend across calibration runs.
- **Slices 6-9** (caching + reducers): ~2 weeks each, sequential. ~$50-100 in LLM spend across all slices.
- **Slices 10-14** (MCP, bootstrap, scanner refactor, navigation migration, full-MVP probe): ~3-5 weeks total. Sustained operating cost begins here.

This is months of work, not days. Sequencing means slice 5 ships the per-node primitive; subsequent slices add reducers; the MCP server is slice 10. Each slice independently provides value.

## Known Issues / Exceptions

- **The substrate's existing tree-sitter blind spots remain.** Reflection / runtime / generated code is not analysed. Per substrate ADR Known Issues.
- **Spring `@ConditionalOn*` and dynamic bean wiring.** The `file-analyser` agent emits a `concept_caveat: "active in profile X / conditional on Y"` annotation but does NOT infer runtime wiring. Documented as visible degradation.
- **Cross-repo edges remain Phase 4** of the substrate. Cross-repo *concept equivalence* (via `concept-merger`) is achievable from MVP onwards; cross-repo *call graphs* are not.
- **Document repo (`documentation/docs/**/*.md`) is not enriched.** Doc content is read as ground truth for Type 5 probes, not analysed as nodes. A separate doc-side ontology is a future ADR.
- **Pure-LLM understanding of obfuscated / generated code is documented as out-of-scope.** Files in `build/generated/`, `target/generated-sources/`, `node_modules/` are excluded from enrichment; their structural nodes remain in the substrate.
- **Documentation contamination (P15) is mitigated, not eliminated.** Where the doc and the code happen to *agree* on a misleading framing, the substrate cannot independently flag that. The pillar's editorial-audit playbook (`playbooks/doc-product-editorial-read.md`) remains the human-judgment-driven backstop.
- **Tail-rate hallucination on non-critical fields will leak through.** A claim with a valid `code_anchor` and `evidence_excerpt` that nevertheless misinterprets the code's intent is acceptable if caught by spot-check eval. The substrate is a documentation aid, not a formal-verification tool.

## Examples

### Canonical case — i18n (LSN-013), revisited under the agentic layer

The substrate's slice 1 produced a node for `i18n.ts` (kind: `ui-shell-bootstrap`) with no semantic content beyond the file path + the auto-derived "no `@docs` annotation" rollup line.

Under the agentic layer:

- `understanding`: "Bootstraps the platform UI's six-language i18n via `react-i18next`, registering English/Spanish/Chinese/French/Ukrainian/Hebrew translations from `locales/translations/*.json` at app startup. Imported as a side-effect by `index.tsx`; consumed via `useTranslation` hook throughout the UI tree."
- `concepts`: `[i18n, locale-bundle, side-effect-bootstrap, react-i18next]`
- `dependencies_semantic`: `[react-i18next library; static JSON locale files; index.tsx as the loader]`
- `tests_coverage_semantic`: `{covered_behaviours: [], uncovered_behaviours: [locale-fallback, missing-key-handling, lazy-loading]}`
- `docs_link_semantic`: `{declared_docs: null, inferred_docs: ["features/internationalization"], doc_drift_findings: ["No documentation page exists for the multilingual UI feature; six locales are user-visible but undocumented"]}`
- `implicit_adrs`: `["i18n is loaded eagerly at app startup as a side-effect import, not lazily per-locale. Implicit decision: simplicity over locale-bundle bandwidth optimization."]`
- `bugs_limitations_corner_cases`: `["Missing-key fallback chain not configured; users in non-English locales may see English keys for untranslated strings (verified: i18n.ts:1-30, no fallbackLng set)."]`
- `sources`: `[i18n.ts:1-30, locales/translations/*.json (file existence), index.tsx (side-effect import)]`

The DOC-163 finding F-047 ("multilingual UI completely undocumented") becomes one of the doc-gap reducer's outputs, with the implicit-ADR ("eager startup, not lazy per-locale") and limitation ("no fallback chain") logged as backlog candidates. **None of this content was extractable by tree-sitter alone.**

### Counter-case — LSN-001 (attachment ephemeral default)

The substrate's slice 4 captured `attachment.storage` as a `config-prefix` node with the consumer chain (per the `config_prefixes` axis output).

Under the agentic layer, the `file-analyser` enriching `MinioConfig.java` (or whichever bean factory consumes attachment storage):

- `bugs_limitations_corner_cases`: `["When attachment.storage is the default LOCAL_FS mode, attachments are stored on the container filesystem and lost on pod restart. The doc page at configuration-and-deployment/odd-platform.md does not warn about this. (verified: AttachmentService.java:42-55, doc page checked via Type-5 probe)"]`
- This becomes a Type-5 doc-drift finding: the code does X, the doc says nothing about it. DOC-NNN candidate.

The LSN-001 incident class becomes *structurally surfaceable* by the substrate, instead of relying on operator pain.

### Precursor in the existing workspace

The substrate ADR's MVP acceptance criterion already states: "MVP is accepted only when (a) the seed probe set passes, (b) an adversarial round of 3 unannounced probes from the maintainer has ≥2 PASS, (c) probes become permanent regression tests." This ADR extends that discipline to semantic claims (PROBES.md "Cross-validation against the existing substrate's syntactic probes") — not invented from scratch.

## References

- **Trigger conversation:** 2026-05-08 — paradigm critique after substrate slice 4 shipped
- **Research artefacts** (in `adrs/drafts/research/agentic-code-ontology/`):
  - `STACK.md` — Anthropic SDK + Claude Code tool surface; orchestrator-workers; persistence; prompt caching + Batch API
  - `PRIOR-ART.md` — production tools' KG construction patterns; consensus design 2024-2025; what to adopt vs reject
  - `ARCHITECTURE.md` — hybrid vs pure-agent; ontology schema; six-agent set; storage layout; first-slice scope
  - `STABILITY.md` — determinism strategies; concrete cost numbers; prompt caching strategy; drift detection; incremental refresh; repeatability probes
  - `PITFALLS.md` — 15 named failure modes (P1-P15); top-3 ODD-specific risks; cross-cutting prevention; what we will NOT prevent
  - `PROBES.md` — six probe types; sample-then-judge MVP; LLM-as-judge integration; adversarial round; cross-validation against substrate
  - `SUMMARY.md` — synthesis of the above with confidence-leveled recommendations and the binary adopt/defer/reject pending
- **Related drafts:**
  - `adrs/drafts/code-lineage-substrate.md` revision 2 — the substrate this layer composes with. Slices 1-4 shipped under that ADR's plan.
- **Retrospectives that this substrate addresses (semantically, not just structurally):**
  - `LSN-001` — attachment ephemeral default (P15-class incident; this layer's bidirectional doc-drift probe surfaces it)
  - `LSN-002` — MinIO region unset (P15-class; same probe class)
  - `LSN-006` — lookup-tables content homing (concept-merger reducer surfaces)
  - `LSN-007` — SUMMARY convenience placements (doc-gap reducer surfaces)
  - `LSN-013` — research-punted (the deep-research playbook this ADR follows)
  - `LSN-014`, `LSN-015` — pause-and-ask + intuition-authored playbook (memory + research discipline that ships this ADR research-backed)
  - `LSN-016` — heuristic-substrate-no-semantic-content (the case-law for this paradigm pivot; logged alongside this ADR per the deep-research playbook step 6)
- **Existing workspace artefacts that converge into this proposal:**
  - `lineage/` — substrate scaffold (slices 1-4 shipped; this layer composes with)
  - `lineage/PROBES.md` — substrate probe protocol (this layer extends to semantic claims)
  - `playbooks/{deep-research, follow-up-on-disk, claim-inventory, consumer-read, pause-and-ask}.md` — universal-gate protocols this layer respects
  - `pillars/documentation/{cornerstones, gates, authoring}.md` — the active pillar's bar that this layer's outputs must hold
  - `~/.claude/projects/-home-rdamayeu-work-odd-odd-team/memory/feedback_agentic_over_heuristic.md` — the auto-memory entry capturing the paradigm-pivot critique

## MVP acceptance (2026-05-10)

**Status:** Accepted. MVP shipped 2026-05-09 with slice 9 merge (PR #132).

The binary "adopt / defer / reject" call originally posed at the bottom of this ADR was implicitly **adopted** by the maintainer when slice 5 (file-analyser + /enrich) was scheduled and merged. Slices 6-9 followed across 2026-05-08 and 2026-05-09. The full slice-progression delivered all six agentic-layer subagents + five reducer-output artefacts + the query-time `/code-walk` skill:

| Slice | Agent | Skill | Output artefact | PR |
|---|---|---|---|---|
| 5 | `file-analyser` | `/enrich` | `lineage/{repo}/understanding/{slug}.md` (15 sidecars on odd-platform) | merged |
| 6 | `concept-merger` | `/concepts` | `lineage/{repo}/concepts.yaml` (31 concepts) | #129 |
| 7 | `doc-gap-finder` | `/doc-gap-check` | `lineage/{repo}/doc-gaps.md` (27 candidates) | #133 |
| 8 | `adr-archaeologist` | `/find-implicit-adrs` | `lineage/{repo}/{implicit-adrs.md, refactoring-scopes.md}` (16 ADRs + 44 scopes, post-wisdom-test) | #130 + #131 (fix) |
| 8 | `test-coverage-mapper` | `/test-coverage` | `lineage/{repo}/test-map.yaml` (69 test gaps) | #130 |
| 8 | — | `/probe` | (runs validation rounds; in-place) | #130 |
| 9 | `feature-advisor` | `/code-walk` | `lineage/{repo}/feature-walks/{date}-{slug}.md` | #132 |

The slice-8 fix (PR #131) added the **3-question wisdom test** to the adr-archaeologist, splitting ADR candidates from refactoring scopes per Nygard 2011 / adr.github.io / AWS Prescriptive Guidance. The file-analyser was tightened on the upstream side (intent-required routing for `implicit_adrs`; gap-shaped routing for `bugs_limitations_corner_cases`). The slice-8 review-loop is itself an in-band validation case-law that caught a load-bearing classification miss without requiring a formal probe round.

### Probe gates — deferred to continuous validation

The "MVP acceptance — probe-driven validation" section above listed eight probe-driven gates. After slice 9 shipped, the maintainer's explicit position (2026-05-10): *"We could always add ADRs afterwards, we should not spend days and weeks just in discussion. I don't have time."* Per memory rule `feedback_defer_human_only_gates.md` and the workspace's "Velocity is the partner of Pride" principle (CLAUDE.md), the gates split as follows:

| Gate | Cost shape | Status | Disposition |
|---|---|---|---|
| Substrate seed probes (12 existence-of-capability) | tool-only | ✅ PASS | inherited from substrate MVP |
| Type 2 stratified faithfulness (n=200) | sampling | not run | deferred — run when ≥50 sidecars exist (currently 15) |
| Type 3 cross-axis joins (5 invariants) | sampling | not run | deferred — run after enrichment expansion |
| Type 5 doc-as-ground-truth | partial | partially covered by /doc-gap-check (27 candidates surfaced) | deferred — formalise alongside Type 2 |
| **Type 4 adversarial** (3 maintainer-authored fabricated-capability probes) | maintainer-only | not run | **DEFERRED** to continuous validation; `/probe --adversarial` available |
| **Type 6 implicit-ADR confirmation** (5 maintainer-authored ADRs vs catalog) | maintainer-only | not run | **DEFERRED** to continuous validation; `/probe --implicit-adrs` available |
| LLM-judge vs maintainer Cohen's κ ≥ 0.6 | calibration | not run | deferred — requires Types 2/4/6 outputs first |
| Fabricated-node count (Type 4 CRITICAL FAIL gate) | inherited from Type 4 | not run | deferred with Type 4 |

**The gates are not abandoned.** They migrate from "MVP gate" to "continuous validation as the ontology gets used." Real `/code-walk` runs surface ontology coverage gaps in practice; real maintainer reads of `implicit-adrs.md` and `refactoring-scopes.md` catch hallucinations as they occur; probe rounds can be scheduled when capacity permits a focused 30-45 minute session.

### Why deferral is safe here

- **The ontology is small** (15 sidecars / 3.8% substrate coverage). Hallucination at this scale is reviewable by the maintainer in one pass; formal probe rounds add diminishing value over direct read.
- **The slice-8 review caught the most load-bearing failure mode** (ADRs vs refactoring scopes; 7 reclassifications) without a formal probe round. In-band human review is operating as an effective probe.
- **Continuous validation is more honest than ceremony.** Every real `/code-walk`, every maintainer-read of an artefact, every PR review is a probe. Ceremony rounds are valuable when they catch something review-flow misses; deferring them preserves the option without burning capacity preemptively.
- **The bar lives in the artefacts, not their probe history.** The MVP is held to a "world-class documentation product" standard (CLAUDE.md "Why this is possible now"), not a "bullet-proofed-by-validation-ceremony" standard. The artefacts are reviewable on their own merits.

### Next decision points

- **Enrichment expansion** (15 → 50? 100?) — operator-driven; expand when `/code-walk` runs reveal ontology coverage gaps in real use.
- **Slice 10+** (MCP server, scanner refactor, navigation migration, full-MVP probe) — proceed against the merged MVP per the ADR's roadmap-implications section.
- **Probe rounds** — schedule when `/code-walk` runs reveal the need (false-positive coverage claims, missing implicit ADRs, etc.) or when the maintainer has 30-45 min of focused capacity.

The ADR's draft status moves to **accepted** with this section as the acceptance record. The slice-progression continues; no further "adopt/defer/reject" decision is pending.
