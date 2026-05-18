# Approach — agentic code ontology for living codebases

A portable methodology for building a queryable, self-maintaining ontology of any non-trivial codebase, run by AI maintainers inside Claude Code. Originally built for Open Data Discovery (Java + Spring + React + TypeScript); applicable to any project with source code, documentation, and tests.

**Audience.** Two readers: (a) the human engineer of a new project who wants to bring this approach over without reinventing it; (b) Claude Code itself, invoked from that new project, pointed at this workspace, asked to bootstrap the same approach for a different stack.

**Scope of portability.** The METHODOLOGY ports: three-layer architecture, sidecar schema, reducer subagent shapes, case-law format, probe protocol, Quality Bar rules. The CONCRETE INSTANCES do not: per-language tree-sitter extractors, project-specific node kinds (controllers vs CLI commands vs GraphQL resolvers), the case-law file contents (LSN incidents are project-specific), the canonical concept page. Copy the framework; author the instances.

---

## 1. Mission — what this gives you

A single coherent answer to six questions any non-trivial codebase eventually faces:

1. **Onboarding** — new dev (human or AI) walks in and gets a working mental model of dependencies, concepts, and approaches from versioned artefacts, not tribal knowledge.
2. **Impact analysis** — "I want to add X" returns a structured map: affected concepts, related controllers/services, doc pages that must update, tests that must extend, ADRs that constrain the change.
3. **ADR archaeology** — implicit decisions ("we always do Y, just never wrote it down") surface as ADR candidates from cross-file pattern emergence. Drift from existing ADRs surfaces as code-vs-decision gaps.
4. **Test-coverage map** — every code behaviour declared on the per-node sidecar has a known test (covered) or a known absent test (gap, ranked by criticality).
5. **Security + performance posture** — sparse per-file signals aggregate into per-concept assessments: this feature's auth posture, its hot paths, its known gaps — with file:line evidence.
6. **Doc-drift detection** — every doc-link claim is bidirectionally verified against the live published doc. Code says X, doc says Y; the substrate surfaces both.

The outcome is **lineage of meaning, not paths** — see `retrospectives/LSN-016` for the case-law that forced this framing.

---

## 2. Why this approach exists (the failure modes it solves)

Two failure modes the approach exists to defeat. Both have case-law in `retrospectives/`.

**Failure A — tribal-knowledge decay** (pre-LLM operating mode). Architecture, conventions, corner-cases live in maintainers' heads. Doc drifts; new joiners reinvent. ADRs get written retroactively if at all. Most projects ship knowledge-loss as a feature.

**Failure B — heuristic-only enumeration** (early pre-LLM tooling, the trap LSN-016 calls out). A tree-sitter / regex / annotation walker produces syntactically-correct nodes ("here is every `@RestController`") but zero semantic content ("what is this controller FOR? where does the doc disagree? what bugs lurk?"). It misses code that does the same thing with a different annotation. It produces no `implicit_adrs`, no `caveats`, no divergence findings. **A heuristic substrate that calls itself lineage is the antipattern.**

The approach defeats both by **layering**: heuristic gives stable IDs cheaply (the scaffold); LLM agents enrich those IDs with semantic content (the meat); reducers turn per-file signals into emergent cross-file findings (the payload). The layering matches the 2024-2025 industry consensus (LazyGraphRAG / Aider repo-map / Sourcegraph-deprecating-embeddings / KG-CodeGen-May-2025) and was validated through the substrate ADR's research pass — see `adrs/drafts/research/agentic-code-ontology/` for the long-form.

---

## 3. The three-layer architecture

| Layer | Lives in | What it produces | Why this layer exists |
|---|---|---|---|
| **1. Substrate** (deterministic) | `lineage/_extractor/` Python driver; tree-sitter parsers per language | `nodes.jsonl` (one node per code entity) + `edges.jsonl` (containment, calls, configures, exposes, mounts, references) + `manifest.yaml` (commit anchor, axis versions) | Stable IDs are the join key for everything downstream. Deterministic enumeration is cheap and never hallucinates a node. A heuristic walker is the ONLY layer that should be heuristic. |
| **2. Enrichment** (agentic) | `.claude/agents/file-analyser.md`; one Markdown sidecar per node at `lineage/{repo}/understanding/{slug}.md` | Per-node `understanding`, `concepts`, `dependencies_semantic`, `tests_coverage_semantic`, `docs_link_semantic`, `implicit_adrs`, `bugs_limitations_corner_cases`, `security`, `performance`, `sources`, `confidence_per_field` | A subagent reads ONE node end-to-end, walks 1-hop neighbours when material, WebFetches the live published doc for any claimed link, and emits a sidecar a maintainer would be proud to ship. Per-file context window stays manageable; semantic content is the deliverable. |
| **3. Reducers** (agentic, cross-file) | `.claude/agents/{concept-merger,adr-archaeologist,doc-gap-finder,test-coverage-mapper,feature-advisor}.md`; outputs at `lineage/{repo}/{concepts.yaml,implicit-adrs.md,refactoring-scopes.md,doc-gaps.md,test-map.yaml,feature-walks/}` | Cross-sidecar emergence: shared concepts; recurring ADR patterns; doc divergences; test gaps; impact assessments for proposed features | Single-file enrichment can't see patterns. The reducer steps back across all sidecars + canonical docs and surfaces what no single sidecar could. The 11-sidecar "DISABLED-mode bypass" finding in ODD's `investigator-log.md` is the proof: emergence only the cross-product can produce. |

**Rule of layering**: lower layers never depend on higher layers. The substrate doesn't read sidecars. Sidecars don't read each other. Reducers don't read source code (they read sidecars). The flow is one-way; the dependencies are clear.

---

## 4. Universal building blocks (copy these verbatim)

### 4.1 Node kinds — minimum portable set

Two are **always** present, regardless of language or framework:

| Kind | What it represents | Why universal |
|---|---|---|
| `file` | Every source file in scope (`.java`, `.py`, `.ts`, `.go`, `.yml`, …) | Makes coverage a monotonic ratio (`files-with-sidecar / files-in-scope`). Uninventoried files become visible immediately. Every other kind attaches via `declared_in` edges. Cheap (one tree-sitter walk per language). |
| `concept` | Every named domain concept (User, Policy, Order, Tenant, DataEntity, …) | The cross-axis join key. Concepts are project-specific in CONTENT, universal in SHAPE. Sourced from the project's canonical concepts page (`docs/main-concepts.md` in ODD; rename freely). |

Project-specific kinds are added per stack. ODD's MVP set: `controller`, `controller-method`, `controller-class`, `openapi-tag`, `route`, `config-prefix`, `config-key-consumer`, `config-properties-class`, `ui-shell-bootstrap`, `ui-shell-widget`, `i18n-resource`. Generic stand-ins for other stacks:

- HTTP handlers: `controller`, `controller-method` (Java Spring), or `route-handler` (Express/Flask/Django views), or `lambda-handler` (serverless), or `graphql-resolver`.
- Config surfaces: `config-prefix`, `config-key-consumer`, `config-properties-class`. Keep these; rename the language-specific bits.
- Background work: `scheduled-job`, `worker`, `consumer`, `cron`.
- Storage: `repository`, `dao`, `migration`.
- External integrations: `sdk-builder`, `bean-factory`, `client-config`.
- Interface surfaces: `cli-entrypoint`, `route`, `openapi-tag`, `event-channel`.

**Add a kind whenever a probe surfaces a class of code the substrate can't address.** Don't pre-design kinds for cases you haven't hit.

### 4.2 Edge types — universal set

| Type | Source → Destination semantic | Notes |
|---|---|---|
| `declared_in` | symbol → file | Universal containment. Every non-file node has exactly one `declared_in` edge. |
| `imports` | file → file (or symbol) | Per-language import graph. |
| `calls` | symbol → symbol | Intra-file call graph at MVP; cross-file call graph deferred until needed. |
| `exposes` | controller/router → handler | HTTP/CLI/event surfaces. |
| `wires` | tag/router/router → handler | Routing layer. |
| `configures` | config-prefix/properties-class → config-key-consumer | Configuration provenance. |
| `mounts` | shell/parent → widget/component | UI composition. |
| `references` | symbol → symbol (loose) | Catch-all for declared but un-typed relationships. |
| `embodied_by` | concept → file (or symbol) | The reducer-emitted join from concept catalog back to files that implement it. |

### 4.3 Sidecar schema — per-node enrichment

Every per-node sidecar follows this YAML-front-matter + Markdown structure. The schema is universal; the field contents are per-project.

```markdown
---
node_id: "<verbatim substrate id>"
node_kind: <substrate kind>
axis: <substrate axis>
extracted_at_commit: <git rev-parse HEAD at substrate scan time>
enriched_at_commit: <git rev-parse HEAD at enrichment time>
extractor_version: <semver>
prompt_version: file-analyser/<semver>
enrichment_status: complete | partial | stale | failed
confidence_overall: HIGH | MEDIUM | LOW
session_id: <Claude Code session id>
---

# {descriptor} — semantic understanding

## understanding
2-4 sentences. What the code does, what business behaviour it represents,
how it fits the surrounding feature. Working mental model without opening
the source file.

## concepts
- entities: [<domain objects the code operates on>]
- operations: [<verb-noun phrases — what actions the code performs>]
- invariants: [<rules the code enforces or assumes>]
- audiences: [<who consumes the output / who is affected>]

## dependencies_semantic
- requires-feature: [<features this code depends on>]
- requires-config: [<config keys this code consumes>]
- requires-runtime: [<runtime/infra dependencies>]

## tests_coverage_semantic
- covered_behaviours: [<behaviours with a known test>]
- uncovered_behaviours: [<behaviours with no test>]
- test_files: [<existing test files referencing this node>]
- gaps: |
    <free-form paragraph describing what isn't tested and why it matters>

## docs_link_semantic
- declared_docs: [<doc URLs the source code itself declares via @docs annotation>]
- inferred_docs:
  - url: "<live URL>"
    anchor: "<#section-id>"
    rationale: "<one-line>"
    last_verified_at: "<ISO timestamp>"
    last_verified_status: 200 | 404 | anchor-missing | network-error
    confidence: HIGH | MEDIUM | LOW
- fetched_excerpts: |
    <verbatim quote from the live doc, used for bidirectional drift check>
- doc_drift_findings:
  - "<short claim: doc says X, code says Y, with citations>"

## implicit_adrs
- "<a deliberate decision the code embodies> — evidence: <file:line> — intent_anchor: <how the rationale is signalled> — confidence: HIGH/MEDIUM/LOW"

## bugs_limitations_corner_cases
- "<single bug/limitation> — evidence: <file:line> — severity: CRITICAL/HIGH/MEDIUM/LOW"

## security
- auth_mode_relevance: <which auth modes this code participates in>
- ingestion_filter_relevance: <YES/NO + why>
- authorization_assertions: [<@PreAuthorize, programmatic checks>]
- owner_scoping: <how the code scopes data to a tenant/owner, or N/A>
- data_exposure: [<what data is exposed to whom, with evidence>]
- known_security_gaps: [<gaps, with evidence + severity>]

## performance
- hot_paths: [<hot paths, with evidence>]
- throughput_characteristics: [<shape of throughput, with evidence>]
- resource_allocation: [<allocations per request, with evidence>]
- scaling_characteristics: [<how this scales horizontally/vertically>]
- known_performance_gaps: [<gaps, with evidence + severity>]

## sources
- understanding ← <file:line>
- <field> ← <file:line> + <neighbour-file:line>
- <field> ← WebFetch <URL> <date>, status=<200|404|...>

## confidence_per_field
- understanding: HIGH | MEDIUM | LOW
- concepts: ...
- (every populated section gets a confidence)

## Maintainer notes
<preserved across re-enrichments; the only block the maintainer hand-edits>
```

Three structural rules apply to the schema:

- **Every claim cites a source** (file:line or WebFetch URL+date+status). Otherwise it's removed. Gate 9 in this workspace's CLAUDE.md.
- **Every WebFetch is live.** Pretraining-derived doc claims are forbidden by prompt construction in `file-analyser.md`. Pretraining was the root cause of one of two case-law misses (`retrospectives/LSN-016`).
- **Banned phrases require verification** — "probably", "likely", "should", "looks right", "presumably", "defensible". If you can't verify, write `confidence: LOW + one-line reason`. Otherwise the sidecar gets rejected at validation.

### 4.4 Reducer subagents — universal pattern

| Reducer | Input | Output | What it produces |
|---|---|---|---|
| `concept-merger` | All sidecars' `concepts` + `security` + `performance` blocks; canonical concepts doc | `concepts.yaml` | Deduplicated concept catalog with per-concept security/performance aggregates and `contributing_files` lists. Anchored on the project's canonical concepts page. |
| `adr-archaeologist` | All sidecars' `implicit_adrs` + `bugs_limitations_corner_cases`; existing `adrs/` | `implicit-adrs.md` + `refactoring-scopes.md` | ADR candidates classified `promote / extend-existing / drift / unique-load-bearing`. The 3-question wisdom test (Nygard 2011 / adr.github.io / AWS Prescriptive Guidance) splits real ADRs from implementation gaps; gaps land in `refactoring-scopes.md`. |
| `doc-gap-finder` | All sidecars' `docs_link_semantic` blocks; live doc URLs via WebFetch; canonical concepts page | `doc-gaps.md` | DOC-NNN candidates: broken URLs, missing anchors, code-doc drift, missing pages, coverage gaps, stale pages. |
| `test-coverage-mapper` | All sidecars' `tests_coverage_semantic` blocks; actual test files via Glob+Grep | `test-map.yaml` | TEST-GAP-NNN candidates ranked by node criticality (`concepts.yaml` security_aggregate × performance_aggregate × node-count). Verifies sidecar `test_files` claims; surfaces sidecar-quality findings. |
| `feature-advisor` | All sidecars + concepts.yaml + implicit-adrs.md + refactoring-scopes.md + doc-gaps.md + test-map.yaml + existing `adrs/`; live docs via WebFetch | `feature-walks/{date}-{slug}.md` | Query-time impact analysis. Maintainer asks "I want to add X — what's affected?" before writing code. |

The five reducer outputs together form the **payload**. The substrate + sidecars are inputs to the payload; the payload is what a maintainer consumes day-to-day.

---

## 5. The non-negotiable rules

These are universal across projects. They appear in `file-analyser.md` and the reducer agents as "non-negotiable rules". Don't dilute them.

1. **Live URLs only for documentation.** A subagent's knowledge of project documentation comes from `WebFetch` results in the current session. Never from pretraining. `last_verified_status` is required on every doc-link entry; broken links surface as doc-gap findings rather than being silently coerced to "looks right".
2. **Code-anchor mandate (Gate 9).** Every claim in a sidecar has a `## sources` entry citing `file:line` (or doc URL + date + status). A claim with no anchor is rejected at validation. A claim whose anchor doesn't resolve is rejected.
3. **One sidecar per node per invocation.** No cross-node bleed. Walk neighbours for context, but emit the sidecar for the target node only.
4. **No source code modification by file-analyser.** The subagent has `Read, Grep, Glob, WebFetch, Write` — no `Edit`, no `Bash`. Findings outside the current node's scope become tracked artefacts (commit-body notes / backlog items / upstream issue drafts), not patches.
5. **No absolute filesystem paths in committed artefacts.** Use repo-relative paths in `sources:` blocks. The artefacts get pushed to a public repository; personal home directories and internal hostnames must not leak.
6. **Banned phrases.** "probably", "likely", "should", "looks right", "presumably", "defensible", "canonical owner", "monorepo default", "safe to assume". Replace with `confidence: LOW + one-line reason` or `VERIFIED via {fetch/grep/read}`.
7. **Maintainer-curated entries survive refresh.** A `Maintainer notes` block in a sidecar; a `maintainer_curated: true` flag in `concepts.yaml`. The reducer preserves these across re-runs.
8. **Probe-driven acceptance, not coverage-%-driven.** A passing probe round means the substrate handles the categories you tested for; it does NOT mean exhaustive. See section 7.

---

## 6. How to apply this to your project (Django, Go, Node, anything)

Six steps. First two are universal; the rest are project-specific.

**Step 1 — Mirror this workspace's structure into your project's coordination repo.**

```
your-project-team/
  CLAUDE.md                       # workspace operating bar (copy + adapt)
  APPROACH.md                     # this file, unchanged
  adrs/drafts/                    # ADRs you author
  retrospectives/                 # LSN case-law — empty at start, fills as you ship
  playbooks/                      # PROTOCOL files (copy + adapt)
  pillars/                        # active maintenance pillar (docs / tests / features / ...)
  scanners/                       # audit definitions
  backlog/                        # work items
  findings/                       # raw scan output
  lineage/
    _extractor/                   # Python tree-sitter driver — copy + add your language(s)
    PROBES.md                     # probe-driven validation (copy structure; author your own probes)
    {your-repo}/                  # one directory per scanned repo
      manifest.yaml
      nodes.jsonl
      edges.jsonl
      understanding/              # per-node sidecars
      rollups/                    # per-axis Markdown diffable summaries
  .claude/
    agents/                       # subagent system prompts (copy verbatim, swap repo-specific examples)
    skills/                       # maintainer-facing slash commands (copy)
```

Five files are pure-copy: `APPROACH.md` (this one), the subagent system prompts in `.claude/agents/`, the universal playbooks in `playbooks/`, the sidecar validator, the manifest shape. Three files need authoring with your project's context: `CLAUDE.md` (your project's quality bar + active pillar), the per-language tree-sitter extractors (one per source language), and your canonical-concepts page (`docs/main-concepts.md` equivalent — the vocabulary the concept-merger anchors on).

**Step 2 — Identify your project's universal axes.** Files (always) and concepts (always). The substrate extractor's `files.py` walks every source file; the `concepts.py` extractor reads your concepts.yaml and emits concept nodes. These two axes work day one with zero project-specific code.

**Step 3 — Identify your project's specific axes.** Walk your codebase and answer: what are the high-leverage SLICES — the kinds of code where a missing entry would be load-bearing? ODD's set is `controllers + openapi_tags + ui_routes + ui_shell + config_prefixes`. A Django project might pick `views + urls + management_commands + celery_tasks + settings_modules + migrations`. A Go service might pick `http_handlers + grpc_handlers + cmd_entrypoints + cobra_commands + config_consumers`. **Don't pre-design every axis.** Pick the 3-5 highest-leverage to ship MVP; add axes when a probe surfaces a class you missed.

**Step 4 — Author your canonical concepts page.** A single Markdown document (`docs/main-concepts.md` or equivalent) naming the domain vocabulary the project uses: entities, lifecycle states, key operations. The concept-merger anchors clustering on this page. Extensions surface as `canonical_candidate: true` entries to be triaged into the docs.

**Step 5 — Write per-language tree-sitter extractors.** One per language you scan. Java + TypeScript + YAML for ODD; replace with Python + HTML for Django, or Go + YAML for a Go service. Each extractor is independent; the substrate is the union. Files in `lineage/_extractor/src/lineage_extractor/extractors/`.

**Step 6 — Run the cycle.**

```
substrate scan         → nodes.jsonl + edges.jsonl + rollups (10 minutes)
enrich --batch <axis>  → 5 sidecars (1 session)
reduce concept-merger  → concepts.yaml refresh
reduce adr-archaeologist → implicit-adrs.md + refactoring-scopes.md refresh
reduce doc-gap-finder  → doc-gaps.md refresh
reduce test-coverage-mapper → test-map.yaml refresh
probe                  → adversarial round catches blind spots
commit + open PR
```

Cadence: one batch per session is comfortable; the manifest carries `last_scan_commit` / `last_enriched_commit` so the next session resumes from disk state. Investigator-log (or equivalent) carries a one-paragraph batch summary so a new session can pick up cold.

---

## 7. The probe protocol (universal)

A probe is a four-step exercise (see `lineage/PROBES.md` for the worked example):

1. **Name a user-visible capability.** Concrete, observable, one sentence.
2. **Locate it in code.** Which file/symbol primarily implements it? If you can't locate it, that's a navigation gap (separate finding).
3. **Run the substrate's enumeration query for that capability's expected axis.** E.g., "is i18n bootstrap present?" → query `WHERE axis = 'ui_shell' AND kind = 'ui-shell-bootstrap'`.
4. **PASS / FAIL.** PASS if the code-location appears in results with the expected kind and metadata. FAIL = `axis gap` (substrate lacks an axis for this capability — add one), `extractor bug` (axis exists but query missed the location — patch query), or `annotation gap` (node exists but lacks doc-link metadata — fix annotation).

**Acceptance is probe-driven, not coverage-%-driven.** A probe round (seed set + adversarial round of 3 from a maintainer who didn't write the seeds) must score ≥2-of-3 PASS. `coverage_pct` over the substrate's own enumeration is meaningful relative to known axes, never the acceptance criterion.

**The probe list extends with every miss.** When an incident produces an LSN retrospective, the rule-that-emerged includes a probe that would have caught it. `lineage/PROBES.md` is a continuously-runnable regression suite for the substrate's coverage.

---

## 8. Case-law method (universal)

Every miss becomes a retrospective with a fixed shape (`retrospectives/LSN-NNN-{slug}.md`):

```markdown
---
id: LSN-NNN
title: <one-line description of the miss>
date: <ISO>
domain: <which pillar / phase the miss occurred in>
severity: low | medium | high
gates_informed: [<playbooks/playbook-name.md>, <feedback_memory_name.md>]
status: open | closed
---

# LSN-NNN: <title>

## What happened
<2-4 paragraphs reconstructing the incident with file:line evidence>

## Why it slipped
<root cause(s); structural rather than personal>

## Rule that emerged
<the executable protocol or auto-memory the workspace gains>

## Forcing question
<the one question that, if asked in advance, would have caught the miss>

## References
- File:line evidence
- Related LSN entries
- Related playbooks
- Related auto-memory
```

Retros are **not blame artefacts**. They convert one-time pain into permanent guardrail. The probe set extends; a playbook fires earlier; a Quality Bar gate grows a specific clause. Case-law compounds — by year-end the workspace's gates encode dozens of incidents, no single one of which a new maintainer needs to relive.

---

## 9. Cost discipline (universal)

This is an unfunded open-source mode of operation. The constraint is session-token budget, not API spend (Claude Code runs on a flat subscription; no external LLM calls are allowed — see `retrospectives/LSN-016` Rule 2). Three disciplines apply:

| Discipline | What it costs / saves | How |
|---|---|---|
| **Incremental reducers** | Cuts per-batch tokens ~40-60% | Reducers read NEW sidecars + a compact head-of-prior-artefact (concept names, gap_ids), not the full prior artefact. Curated maintainer entries sit in a side-file the reducer ALWAYS reads; uncurated entries are append-only with dedup. |
| **Tiered sidecars** | Cuts per-sidecar tokens ~30-50% on trivial nodes | An `i18n-resource` doesn't need a 30-line `security` block with `auth_mode_relevance: N/A` everywhere. The schema declares which sections are MANDATORY (understanding, concepts, sources, confidence_per_field) vs CONDITIONAL (security/performance only when the node has security/performance surface). |
| **Cache-aware enrichment** | Skips work when nothing changed | A sidecar is cached if `(enriched_at_commit, prompt_version, source_unchanged_since_enriched_at_commit)` all match current state. Force a re-run with `--no-cache`; the cache invariant is in `enrich/SKILL.md`. |

What's NOT a discipline (deliberate non-optimisation):

- **No vector store / RAG layer.** Per `retrospectives/LSN-016`: the failure modes the approach defeats are structural blind-spots, not "couldn't find a similar text" problems. Embeddings add operational complexity and an external dependency without solving the actual failure shape. Sourcegraph's 2024 deprecation of Cody embeddings is the industry signal.
- **No external LLM calls.** Claude Code is the runtime; subagents are filesystem prompts; skills are slash commands. No Anthropic API driver, no Batch API queue, no Agent SDK wrapper. Cost shape: session-tokens × maintainer-sessions, capped by subscription tier.

---

## 10. What to copy vs what to author

| Copy verbatim from this workspace | Author for your project |
|---|---|
| `APPROACH.md` (this file) | `CLAUDE.md` (your project's quality bar, active pillar pointer) |
| `.claude/agents/file-analyser.md` (swap project-specific examples in the system prompt; keep the schema + rules verbatim) | Your canonical-concepts page (`docs/main-concepts.md` equivalent) |
| `.claude/agents/{concept-merger,adr-archaeologist,doc-gap-finder,test-coverage-mapper,feature-advisor}.md` | Per-language tree-sitter extractors at `lineage/_extractor/src/lineage_extractor/extractors/` |
| Sidecar schema (section 4.3 of this doc) | Your project-specific axes (HTTP handlers / CLI / GraphQL / scheduled / migrations) |
| Reducer-output shapes (concepts.yaml, implicit-adrs.md, refactoring-scopes.md, doc-gaps.md, test-map.yaml) | Your seed probe set in `lineage/PROBES.md` |
| Probe protocol (section 7) | Your project's LSN retrospectives (start empty; fill as you ship) |
| LSN retrospective shape (section 8) | Your project's playbooks and feedback memories |
| Quality Bar rules (section 5) | Your maintainer team's pillar definition |
| Playbooks (`playbooks/*.md`) — most are universal | Skill catalog adjustments (the 16 skills here are mostly portable; adjust slash names if conflicting) |

---

## 11. Bootstrapping signal — what tells you the approach is taking hold

| Signal | What it means |
|---|---|
| The substrate produces nodes on a probe you didn't seed | The structural seed is wide enough to surface unanticipated capabilities. |
| Two or three sidecars surface the same implicit ADR | Cross-file emergence is starting. The reducer round will promote it. |
| A reducer finds a doc-vs-code drift that a maintainer didn't already know | Divergence detection is working. |
| A retrospective produces an LSN whose rule lives as a playbook | Case-law is compounding into executable guardrails. |
| The next session opens, reads `state/PROGRESS.md` + `investigator-log.md`'s tail, and picks up cold | Multi-session incremental build is real; tribal knowledge has externalised. |

If a quarter goes by and none of these signals fire, the approach isn't taking hold — likely the sidecar quality is too shallow (Gate 9 not enforced), or the canonical concepts page hasn't been authored, or the project-specific axes don't actually cover the high-leverage code.

---

## 12. References — the long-form

This document is the methodology surface. The depth lives elsewhere in this workspace:

- `adrs/drafts/code-lineage-substrate.md` — substrate design (revision 2, research-backed). Anchors. Run modes. Tree-sitter stack choice rationale.
- `adrs/drafts/agentic-code-ontology.md` — enrichment + reducer design (revision 2, runtime-corrected). Sidecar schema. Subagent shapes. Why hybrid not pure-agent.
- `adrs/drafts/research/code-lineage-substrate/` and `adrs/drafts/research/agentic-code-ontology/` — research artefacts produced via the gsd-build/get-shit-done parallel-researcher pattern.
- `retrospectives/LSN-013` — research-punt case-law (why ADRs don't end with "open questions for human review").
- `retrospectives/LSN-016` — heuristic-vs-agentic case-law (why a tree-sitter substrate alone is not lineage; why Claude Code is the runtime, not the Anthropic API).
- `lineage/PROBES.md` — probe-driven validation as worked example (the i18n class, the security-default class, the housekeeping class).
- `CLAUDE.md` — workspace-operating bar (Principal Full-Stack standard, Quality Bar, autonomous-execution discipline). The `.claude/` directory is the executable form.
- `pillars/documentation/` — active pillar's cornerstones, gates, canonical-homes table, authoring rules. Template for activating new pillars.
- `playbooks/` — PROTOCOL-format universal rules (deep-research, pause-and-ask, consumer-read, live-site-verification, follow-up-on-disk, …).

If you're a Claude Code session invoked from another project pointed at this workspace: read this file end-to-end, then drop into the ADRs for the design rationale, then read one or two representative sidecars in `lineage/odd-platform/understanding/` to see the schema in practice. That's enough to bootstrap.
