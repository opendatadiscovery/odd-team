---
research: agentic-code-ontology
artifact: STACK
date: 2026-05-08
mode: web + workspace
overall_confidence: HIGH
---

# STACK — toolchain decision

## Recommendation

1. **Build the ontology pipeline as a Claude Agent SDK program with programmatic subagents (`agents={...}`).** Not as filesystem subagents under `.claude/agents/`, not as agent teams, not as composed `/skills`. **HIGH confidence.**
2. **Orchestration shape is one orchestrator + N parallel `general-purpose`-class subagents per pass.** Subagents are stateless workers spawned per file batch; the orchestrator owns the queue and the merge. Mirrors Anthropic's own multi-agent research system pattern. **HIGH confidence.**
3. **Run periodic full-codebase passes via the Message Batches API (50% discount, <24h SLA, often <1h).** Run incremental refresh (touched-files-only, on `/scan` invocation) via the synchronous Messages API. **HIGH confidence.**
4. **Use 1-hour prompt caching (`ttl: "1h"`)** for the per-pass system prompt + the static codebase context block (CLAUDE.md, ADRs, ontology schema, retrospectives index). **HIGH confidence.**
5. **Persistence is JSONL (one line per ontology node) + per-node sidecar markdown for prose enrichments + YAML manifest.** Same shape as the existing `lineage/` substrate. **No SQLite, no graph DB, no Files API, no vector store** for MVP. **HIGH confidence.**
6. **Skills (`/skill-name`) are the maintainer-facing entry points only; they shell out into Agent SDK orchestrator scripts.** Skills do not compose into pipelines — that is not what the schema is for. **HIGH confidence.**

## Rejected alternatives

| Rejected | Why | Confidence in rejection |
|---|---|---|
| **Roll our own agent loop** with raw Messages API + manual tool dispatch | Anthropic eng explicitly enumerates three primitives the SDK already gives you (gather context / take action / verify) ([Claude Agent SDK post](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)). Re-implementing the loop costs ~weeks and mis-implements compaction / hooks / permission modes. The substrate has a 2K-LOC budget; agent-loop infrastructure must not be in it. | HIGH |
| **Filesystem subagents (`.claude/agents/*.md`) as the analysis primitive** | Filesystem subagents are session-scoped and human-orchestrated; they shine when a *human* in Claude Code wants to delegate a side-task and recover the summary. They are not orchestratable from outside Claude Code. The ontology pipeline runs on cron / on `/scan` / on CI; it must be programmatic. | HIGH |
| **Skill-composition pipeline** (e.g., `/analyze-file` → `/find-implicit-adrs` → `/doc-gap-check` chained) | Skills are a single-shot prompt-injection mechanism: `SKILL.md` content enters the conversation and stays there ([Skills doc](https://code.claude.com/docs/en/skills)). One skill cannot spawn another. They are reference-content + task-trigger pairs, not pipeline stages. | HIGH |
| **Agent teams** (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) | Agent teams are explicitly experimental, gated by env flag, with documented limitations ("no session resumption with in-process teammates," "task status can lag," "shutdown can be slow") ([Agent teams doc](https://code.claude.com/docs/en/agent-teams)). They are also designed for *human-in-the-loop* parallel work where teammates *talk to each other* — the ontology pipeline doesn't need inter-agent negotiation. Use the cheaper, more stable subagent pattern. | HIGH |
| **Files API for codebase ingestion** | Files API supports PDFs, plain text, images. Code files (`.ts`, `.java`, `.py`) fall into the "convert to plain text and inline" guidance ([Files API doc](https://platform.claude.com/docs/en/docs/build-with-claude/files)). It also is **incompatible with prompt caching** for our use case — uploaded `file_id` references add billed input tokens but don't unlock cached prefixes the way an inlined `cache_control` block does. Files API is for binary blobs the code-execution tool consumes, not source-code analysis. | HIGH |
| **Vector DB / embeddings retrieval over the codebase** | Anthropic's own SDK guidance: "we suggest starting with agentic search, and only adding semantic search if you need faster results" ([Claude Agent SDK post](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)). The substrate already provides a deterministic worklist (file paths from `tree-sitter`); vector search would solve a problem we don't have. | HIGH |
| **SQLite / graph DB for the ontology** | Diff-friendliness is mandatory. The existing substrate ships JSONL + YAML + Markdown precisely so PR review of an ontology refresh is a readable diff, not a binary blob. Graph queries we don't yet have are not worth giving that up. (Per-pillar query speed is not yet a constraint.) | HIGH |
| **Memory tool / `~/.claude/agent-memory/`** as the ontology persistence | The Memory tool / agent-memory directory is meant for *cross-session learnings* — "codebase patterns and recurring issues" the subagent itself accumulates ([sub-agents doc](https://code.claude.com/docs/en/sub-agents)). It is not the right home for a deliverable artefact the rest of the workspace queries. The ontology is a versioned commit-tracked artefact under `lineage/`, not a private agent scratchpad. | HIGH |

## Decision 1 — Agent orchestration on Claude Code

**Pattern: orchestrator + N parallel programmatic subagents, written as a Claude Agent SDK program.**

Anthropic's own multi-agent research system documents the canonical shape: "lead agent (Claude Opus) analyzes queries, develops strategy, and spawns specialized subagents (Claude Sonnet) that operate in parallel with separate context windows" — a hierarchical orchestrator-worker model, not peer coordination ([How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)). Their reported result: "outperformed single-agent Claude Opus 4 by 90.2%" on research tasks; "research time cut by up to 90% for complex queries" via parallel tool-calling. They also flag the cost: "about 15× more tokens than chats."

For our use case (file-by-file semantic enrichment over hundreds of files), this maps directly:

- **Orchestrator** (Opus 4.7) holds the worklist, the ontology schema, the merge logic, and the manifest. Reads only summaries from workers.
- **Workers** (Sonnet 4.6) each receive a batch of N files (5-20 per batch) and the cached system prompt; emit one ontology node per file as JSON.
- **Concurrency** is whatever the SDK gives us: subagents documented to "run concurrently, dramatically speeding up complex workflows" ([SDK subagents doc](https://code.claude.com/docs/en/agent-sdk/subagents)). Empirical sweet-spot per Anthropic: "complex research uses more than 10 subagents with clearly divided responsibilities." Realistic budget for our workspace: **5-10 parallel workers per pass**.

The subagent invocation lives in code that looks like ([SDK subagents doc](https://code.claude.com/docs/en/agent-sdk/subagents)):

```python
async for message in query(
    prompt="Enrich the next batch of 8 files...",
    options=ClaudeAgentOptions(
        allowed_tools=["Read", "Grep", "Glob", "Agent"],
        agents={
            "file-analyzer": AgentDefinition(
                description="Reads one source file and emits an ontology node JSON.",
                prompt="<system prompt with ontology schema, cached>",
                tools=["Read", "Grep", "Glob"],
                model="sonnet",
            ),
        },
    ),
):
    if hasattr(message, "result"):
        merge_into_ontology(message.result)
```

**Critical SDK constraints we honour:**

- "**Subagents cannot spawn their own subagents.** Don't include `Agent` in a subagent's `tools` array." ([SDK subagents doc](https://code.claude.com/docs/en/agent-sdk/subagents)) — our workers are leaves; the orchestrator is the only spawner.
- "**The only channel from parent to subagent is the Agent tool's prompt string**, so include any file paths, error messages, or decisions the subagent needs directly in that prompt." — the orchestrator must serialize the file batch into the prompt.
- "**The parent receives the subagent's final message verbatim as the Agent tool result, but may summarize it.** To preserve subagent output verbatim, include an instruction to do so in the prompt." — workers must be instructed to emit raw JSON only; the orchestrator script (not the orchestrator's own LLM call) merges.
- Programmatic agents take precedence over filesystem agents with the same name, so we don't risk collisions with maintainer-defined `.claude/agents/*.md`.

## Decision 2 — Claude Agent SDK vs Claude Code's built-in Agent tool

**Use the Claude Agent SDK programmatically (Python), not Claude Code's interactive Agent tool.**

The split is documented ([Claude Code vs Claude Agent SDK comparison](https://www.augmentcode.com/tools/claude-code-vs-claude-agent-sdk)): "When a human developer is driving the work interactively, Claude Code is the right tool. For programmatic multi-agent code analysis workflows, the Claude Agent SDK provides more explicit control over subagent orchestration and context management." Anthropic renamed "Claude Code SDK" to "Claude Agent SDK" in March 2026 specifically to mark this generalisation: it's the same harness Claude Code uses, exposed as a library.

**Why SDK wins for the ontology pipeline:**

| Need | Claude Code interactive | Claude Agent SDK |
|---|---|---|
| Run on `/scan` from a maintainer's session | Yes | Yes (via shell-out from a `/skill`) |
| Run from CI / cron / batch refresh | No (interactive only) | **Yes** |
| Programmatic merge of N worker outputs | Subagent results return as text — orchestrator LLM has to parse | **Direct access to message stream — orchestrator script merges, not orchestrator LLM** |
| Cost (no LLM-side merge) | Higher | **Lower** |
| Resume a long-running pass | Limited (one team per session, no `/resume` for in-process teammates) | **`session_id` + agent_id resumption documented** |
| Persistent memory directory for accumulation | `memory: user/project/local` field on agents — reads first 200 lines / 25KB of `MEMORY.md` ([sub-agents doc](https://code.claude.com/docs/en/sub-agents)) | Same field exposed via `AgentDefinition.memory` ([SDK subagents doc](https://code.claude.com/docs/en/agent-sdk/subagents)) |

**Where Claude Code (interactive) shines:** maintainer ad-hoc enrichment of a single file or domain — a `/enrich-file <path>` skill that fires the orchestrator on a tiny worklist and shows the result inline. That's a thin wrapper, not the pipeline.

## Decision 3 — Skills composition

**Skills are entry points, not pipeline stages. Reject the multi-skill-composition idea.**

Two hard constraints from the schema ([Skills doc](https://code.claude.com/docs/en/skills)):

1. **A skill cannot spawn another skill.** The closest mechanism is `context: fork` + `agent: <subagent-name>`, which runs the skill's body inside a forked subagent context. That gives you skill-runs-in-subagent, not skill-runs-skill. There is no documented `invoke: <other-skill>` directive.
2. **Skill content is single-shot prompt injection.** "When you or Claude invoke a skill, the rendered SKILL.md content enters the conversation as a single message and stays there for the rest of the session" — so chaining four skills in one session means all four skill bodies pile up in context permanently, not "stage 1 → free context → stage 2."

**Correct shape for the ontology workspace:**

- `/enrich` — top-level skill, fires the orchestrator script (Python via Bash), passes `$ARGUMENTS` (e.g., `--full`, `--touched`, `--file <path>`).
- `/ontology-query <node-id>` — read-only skill, shells to a Python query script that returns the JSON for one ontology node + its sidecar markdown.
- `/ontology-coverage` — read-only skill, shells to a script that reports which files have been enriched and which are stale (orchestrator's last-run commit vs `git log`).
- (No `/find-implicit-adrs`, `/doc-gap-check` as separate skills) — those are *passes* the orchestrator runs as part of `/enrich`. They are command-line flags on one tool, not three skills.

The supporting-files convention ([Skills doc](https://code.claude.com/docs/en/skills)) is the right place for the orchestrator: skills can bundle `scripts/*.py` and the SKILL.md uses `${CLAUDE_SKILL_DIR}` to reference them. Lifts the orchestrator into the skill's installable footprint.

## Decision 4 — Persistence layer

**Reuse the existing `lineage/` substrate's JSONL + YAML + Markdown shape. Each ontology node is one JSONL line with semantic enrichment fields populated by the orchestrator; verbose prose enrichments live in sidecar markdown files.**

Concrete shape (extending the existing `lineage/{repo}/` schema):

```
lineage/odd-platform/
  manifest.yaml                 # adds: ontology_version, last_enrichment_commit, axes_enriched
  nodes.jsonl                   # one node per line; ontology fields inlined
  edges.jsonl                   # unchanged; substrate-emitted
  ontology/                     # NEW: per-node sidecar prose
    {repo}/{lang}/{kind}/{slug}.md   # one file per enriched node
  rollups/                      # auto-derived (existing)
    ui-shell.md
    sdk-builders.md
    ...
```

Per-node JSONL extension (additive — substrate fields stay, ontology fields are new):

```jsonc
{
  "id": "odd-platform java configuration:AttachmentStorageConfig",
  "path": "src/main/java/.../AttachmentStorageConfig.java",
  "kind": "spring-bean-factory",            // substrate-emitted
  "documents": ["configuration-and-deployment/odd-platform#attachments"],
  // --- ontology enrichment (NEW, per-node sidecar covers the long-form) ---
  "ontology_version": 1,
  "ontology_enriched_at": "2026-05-08T12:00:00Z",
  "ontology_enriched_commit": "279fe8ee",
  "understanding_one_liner": "Spring config that wires the attachment storage backend (filesystem | s3 | minio) from application.yml.",
  "concepts": ["attachment-storage", "spring-boot-config", "filesystem-default"],
  "implicit_adrs": ["ADR-DRAFT: storage backend is pluggable via @ConditionalOnProperty"],
  "doc_link_semantic": [
    {"page": "configuration-and-deployment/odd-platform#attachments", "match": "exact"},
    {"page": "configuration-and-deployment/storage-backends", "match": "should-exist", "gap_id": "DOC-NNN"}
  ],
  "test_coverage_semantic": [
    {"test": "AttachmentStorageConfigTest", "covers": "default-bean-wiring"},
    {"missing": "filesystem-ephemeral-retrospective-LSN-001"}
  ],
  "limitations": ["No persistence-mode caveat in default; LSN-001 case-law"],
  "corner_cases": ["S3 backend silently picks us-east-1 if region unset (LSN-002)"],
  "sidecar": "ontology/odd-platform/java/spring-bean-factory/attachment-storage-config.md"
}
```

The sidecar `.md` carries:

- The full orchestrator-generated prose (50-300 words explaining what the code does, why it's there, the implicit decisions, the doc page it should map to).
- A `Sources:` footer (per the workspace's Gate 9 / factual-provenance discipline).
- Hand-edits the maintainer makes survive future enrichment passes (orchestrator preserves the `## Maintainer notes` heading verbatim; merges its own writes above it).

**Why this shape (not alternatives):**

- **JSONL is line-diffable.** A re-enrichment that touches 12 files produces 12 line changes, not a binary diff. Maintainer can review an ontology refresh in a PR.
- **Sidecar markdown lets prose grow without bloating the JSONL.** A 300-word `understanding` field would make `nodes.jsonl` lines unwieldy. The sidecar pays one extra file open at query-time and unlocks human-readable artefacts.
- **YAML manifest is the integrity ledger.** `ontology_version` bumps force re-enrichment the same way `extractor_version` forces full rebuilds in the existing substrate.
- **No new dependencies.** Same parsers, same git workflow. The pillar-architecture migration ADR's "rails are the floor, not the standard" applies — adding SQLite or DuckDB to support a query language we haven't yet needed is gold-plating.

**On Memory tool / agent-memory:** Subagents *can* opt into persistent memory via `memory: project` ([sub-agents doc](https://code.claude.com/docs/en/sub-agents)) — this is appropriate for the **orchestrator's accumulated heuristics** (e.g., "files matching `*Test.java` need different prompting"), not for the deliverable ontology. Heuristics: maybe yes (Phase 2). Deliverable artefact: emphatically no.

## Decision 5 — Prompt caching + Batch API

**Use both. Prompt caching cuts per-call cost ~10× on the system prompt; Batch API cuts the *total* cost of full passes by 50%. They stack.**

### Prompt caching shape

Sources: ([Prompt caching doc](https://platform.claude.com/docs/en/build-with-claude/prompt-caching))

- 5-minute cache write: **1.25× base input price**
- 1-hour cache write: **2× base input price**
- Cache read: **0.1× base input price** (10× cheaper than re-sending)
- Minimum cacheable prefix: **4096 tokens for Opus 4.7 / Sonnet 4.6 / Haiku 4.5** (some models 2048; verify per model used)
- Maximum 4 explicit `cache_control` breakpoints per request

**For an ontology refresh pass over 100 files at ~6K shared context tokens:**

- Without caching: 100 × 6000 = 600K input tokens at base price = $3.00 (Sonnet 4.6 @ ~$3/MTok)
- With 1h cache: 1× write at 2× ($0.036) + 99× reads at 0.1× ($0.18) ≈ **~$0.22, ~14× cheaper** on the cached prefix alone.

**Cache placement** (per the schema's "place `cache_control` on the last identical block" rule):

```
[ tools                                 ]   ← stable per-pass; cache_control here
[ system: ontology schema + CLAUDE.md   ]   ← stable per-pass; cache_control here
[ system: per-batch instruction         ]   ← changes per batch; do NOT cache
[ user: file path + file contents       ]   ← changes per file; do NOT cache
```

Two breakpoints used out of four available; orchestrator and workers share the same prefix shape so cache hits cascade.

**1-hour TTL not 5-minute.** A full-codebase pass takes ~10-30 minutes; touched-file refreshes are ad hoc. The 5-min cache is too short — we'd pay the write penalty without amortizing reads. The 2× write multiplier is paid once per pass.

**Workspace-level isolation (effective Feb 5, 2026)** ([Prompt caching doc](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)) — caches don't leak between workspaces under the same org. Practical effect for us: zero. We run all enrichment under one workspace.

### Batch API shape

Sources: ([Batch processing doc](https://platform.claude.com/docs/en/docs/build-with-claude/batch-processing))

- **50% discount on input + output tokens.**
- "Most batches finishing in less than 1 hour" (max 24h SLA).
- Up to 10K queries per batch.
- Batch API **does** support prompt caching with normal `cache_control`, and pricing multipliers stack with the batch discount. (The only restriction: pre-warming via `max_tokens: 0` is rejected in batch.)

**When to use:**

- **Full-codebase re-enrichment** (one per ontology version bump, plus periodic refreshes): batch.
- **Incremental refresh on touched files** (per `/scan`, ~10 files): synchronous Messages API. Batch's 1-hour SLA is too slow for an interactive `/scan`.

Combined cost shape for a full pass:

| Strategy | Approximate ratio vs naïve |
|---|---|
| No caching, no batch | 1.0× (baseline) |
| 1h caching only | ~0.10× on the cached prefix |
| Batch only | 0.50× on everything |
| **1h caching + Batch** | **~0.10× on cached prefix × 0.50× on output = sub-$5 for a full odd-platform pass at current prices** (rough — exact bill depends on per-file output volume) |

This is the pricing lever that makes "periodic full-codebase re-analysis" actually feasible for an OSS project with one maintainer. Without these levers, the same-shape pipeline at organic API pricing is operating-cost-prohibitive for our team.

## Decision 6 — Memory + Files API integration

**Files API: do not use. Memory directory: out of scope for the deliverable ontology, optional for orchestrator heuristics.**

### Files API: rejected

Three independently-sufficient reasons:

1. **Source code is not a supported "document" type.** Files API supports PDFs, images, and plain text in `document` blocks ([Files API doc](https://platform.claude.com/docs/en/docs/build-with-claude/files)). For `.java`, `.ts`, `.py` files, the doc explicitly recommends "convert the files to plain text, and include the content directly in your message" — i.e., bypass Files API for code.
2. **It doesn't unlock prompt caching for our use case.** The `cache_control` mechanism caches the inlined prefix. A `file_id` reference adds tokens but the actual cached unit is the rendered request, not the upload. There's no "Files API + prompt caching = cheaper" combo here.
3. **It introduces a separate retention surface.** Files API content is "not eligible for ZDR" and persists until explicitly deleted ([Files API doc](https://platform.claude.com/docs/en/docs/build-with-claude/files)). For a workspace whose entire identity is "every artefact is git-tracked, every claim has a provenance," uploading code to a third storage layer adds risk and complexity for zero workflow benefit.

The right pattern is what the existing CLAUDE.md already does: orchestrator's `Read` tool reads files at runtime; their content goes into a non-cached message block; the cached block contains schema + framework prose only.

### Memory directory: out of scope for the deliverable, possibly Phase 2 for orchestrator self-tuning

The memory mechanism — `memory: user|project|local` on a subagent definition, backed by `~/.claude/agent-memory/MEMORY.md` (first 200 lines / 25KB injected at startup) — is documented as accumulating "codebase patterns and recurring issues" the agent learns over time ([sub-agents doc](https://code.claude.com/docs/en/sub-agents)).

**Why not for the ontology artefact:**

- The ontology must be deterministic-replayable from `(commit, ontology_version, prompt_set)`. A memory file the orchestrator writes-and-reads non-deterministically poisons reproducibility.
- The ontology is consumed by every scanner, gate, and navigation lookup — it must live under `lineage/`, version-controlled and PR-reviewable. `~/.claude/agent-memory/` is a per-user scratchpad.

**Where memory might earn its place (Phase 2):** The orchestrator could maintain a `memory: project`-backed `.claude/agent-memory/orchestrator/MEMORY.md` capturing **prompt-tuning lessons** ("file paths matching `*/test/**` benefit from the `test-aware` system-prompt variant"). That's heuristics about how to enrich, not the enrichments themselves. Defer until we have ≥2 prompt-set iterations.

The workspace's existing CLAUDE.md auto-memory at `~/.claude/projects/-home-rdamayeu-work-odd-odd-team/memory/` — that is the maintainer's persistent memory, distinct from agent-memory. Out of scope here either way.

## Anti-recommendations (deliberately do NOT do)

1. **Do not re-implement the agent loop.** Use `claude_agent_sdk.query()`. The compaction, hooks, permissions, session resumption, and Agent-tool dispatch are all there ([SDK overview](https://docs.claude.com/en/docs/agent-sdk/overview)). A 2K-LOC budget cannot absorb agent-loop infrastructure.
2. **Do not let the orchestrator's LLM call do the merge.** Workers emit JSON; the orchestrator's *script* merges. The orchestrator's LLM is for queue management, batch chunking, and human-readable status. Letting an LLM "merge JSON" introduces hallucination into the ontology — a maintainer-trust-killer.
3. **Do not enable agent teams** until the substrate is mature. They're experimental, expensive (each teammate is a full session), and they shine when teammates *negotiate* — which our pipeline doesn't.
4. **Do not start with semantic / vector search.** Anthropic's own SDK guidance says agentic search first, semantic search later if needed ([Claude Agent SDK post](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)). The substrate is already a deterministic worklist.
5. **Do not store the ontology in any format that isn't line-diffable.** PR-reviewability is non-negotiable for a workspace whose Gate 9 is "every claim cites a SoT." Reviewers must be able to read what changed.
6. **Do not nest subagents.** "Subagents cannot spawn their own subagents" is enforced ([SDK subagents doc](https://code.claude.com/docs/en/agent-sdk/subagents)). Two-level orchestration is the architectural ceiling.
7. **Do not use `Task` tool name.** Renamed to `Agent` in v2.1.63; current SDK emits `Agent` in `tool_use` blocks. Match both for compatibility, but author code against `Agent`.
8. **Do not let the cached prefix be > 8K tokens for MVP.** Cache writes are 2× billed; an over-stuffed prefix burns money on every ontology version bump. Schema + ontology rules + retrospectives index. CLAUDE.md inline only if necessary.

## Summary table — recommendations vs confidence

| Decision | Recommendation | Confidence | Source |
|---|---|---|---|
| 1. Orchestration framework | Claude Agent SDK (Python) with programmatic `agents={}` | HIGH | [SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents), [Multi-agent research post](https://www.anthropic.com/engineering/multi-agent-research-system) |
| 2. SDK vs Claude Code interactive | SDK for the pipeline; CC interactive for ad-hoc maintainer use | HIGH | [Augment comparison](https://www.augmentcode.com/tools/claude-code-vs-claude-agent-sdk), [SDK overview](https://docs.claude.com/en/docs/agent-sdk/overview) |
| 3. Skills composition | Skills are top-level entry points only; pipeline runs in scripts under `${CLAUDE_SKILL_DIR}/scripts/` | HIGH | [Skills doc](https://code.claude.com/docs/en/skills) |
| 4. Persistence | JSONL + YAML manifest + per-node sidecar markdown under `lineage/` | HIGH | Workspace conventions; [substrate research SUMMARY](../code-lineage-substrate/SUMMARY.md) |
| 5a. Prompt caching | 1-hour TTL on schema + framework prose prefix; 5-min skipped | HIGH | [Prompt caching doc](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) |
| 5b. Batch API | Use for full passes (50% discount); sync API for `/scan` incremental | HIGH | [Batch processing doc](https://platform.claude.com/docs/en/docs/build-with-claude/batch-processing) |
| 6a. Files API | Reject — code files inline, no benefit, retention complexity | HIGH | [Files API doc](https://platform.claude.com/docs/en/docs/build-with-claude/files) |
| 6b. Memory directory | Out of scope for deliverable; optional Phase 2 for orchestrator heuristics | MEDIUM | [sub-agents doc](https://code.claude.com/docs/en/sub-agents) |
| 7. Agent teams | Reject — experimental, expensive, wrong shape (no negotiation needed) | HIGH | [Agent teams doc](https://code.claude.com/docs/en/agent-teams) |
| 8. Concurrent worker count | Start at 5-10 parallel workers per pass; tune empirically | MEDIUM | [Multi-agent research post](https://www.anthropic.com/engineering/multi-agent-research-system) ("complex research uses more than 10") |

The **MEDIUM** items (6b memory, 8 worker count) are MEDIUM because they are tuning calls that depend on first-pass empirical signal — not because the source material is weak.

## Sources

- [Create custom subagents — Claude Code docs](https://code.claude.com/docs/en/sub-agents)
- [Subagents in the SDK — Claude Agent SDK docs](https://code.claude.com/docs/en/agent-sdk/subagents)
- [Orchestrate teams of Claude Code sessions — Agent Teams docs](https://code.claude.com/docs/en/agent-teams)
- [Extend Claude with skills — Claude Code Skills docs](https://code.claude.com/docs/en/skills)
- [Prompt caching — Anthropic API docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Batch processing — Anthropic API docs](https://platform.claude.com/docs/en/docs/build-with-claude/batch-processing)
- [Files API — Anthropic API docs](https://platform.claude.com/docs/en/docs/build-with-claude/files)
- [How we built our multi-agent research system — Anthropic engineering](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Building agents with the Claude Agent SDK — Anthropic blog](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)
- [Building a C compiler with a team of parallel Claudes — Anthropic engineering](https://www.anthropic.com/engineering/building-c-compiler)
- [Claude Code vs Claude Agent SDK — Augment Code comparison](https://www.augmentcode.com/tools/claude-code-vs-claude-agent-sdk)
- [Skills explained: Skills vs prompts vs Projects vs MCP vs subagents — Anthropic blog](https://claude.com/blog/skills-explained)
- [Substrate research SUMMARY (workspace internal)](../code-lineage-substrate/SUMMARY.md)
