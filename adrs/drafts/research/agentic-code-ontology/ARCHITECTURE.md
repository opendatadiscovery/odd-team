---
research: agentic-code-ontology
artifact: ARCHITECTURE
date: 2026-05-08
mode: design synthesis
overall_confidence: HIGH
---

# ARCHITECTURE — agentic semantic ontology shape

## Recommended architecture

**Hybrid: tree-sitter SCAFFOLD + LLM-agent ENRICHMENT, orchestrator-workers pattern, JSONL+sidecar storage.** (HIGH)

- **Substrate stays.** Tree-sitter remains the deterministic enumerator. `nodes.jsonl` becomes the **agent worklist** keyed by stable IDs. (HIGH)
- **Enrichment layer = orchestrator-workers** ([Anthropic, *Building Effective Agents*](https://www.anthropic.com/research/building-effective-agents)). One Python driver fans out file-analyser subagents via the Claude Agent SDK `agents={}` parameter; each subagent reads one node's source, emits constrained JSON; driver writes to sidecars. (HIGH)
- **Per-node enrichment lives in `lineage/{repo}/understanding/{node-id-slug}.md`** (Markdown with YAML frontmatter), not inline in `nodes.jsonl`. JSONL stays small and diffable; enrichment is one-file-per-node so a single node refresh produces a one-file diff. (HIGH)
- **Cross-cutting agents** (concept-merger, doc-gap, ADR-archaeologist, test-coverage-mapper) run as **separate orchestrator passes** that read all sidecars and write aggregate artefacts (`concepts.yaml`, `doc-gaps.md`, `implicit-adrs.md`, `test-map.yaml`). They are reducers in the map-reduce sense ([Awesome Agentic Patterns, *LLM Map-Reduce*](https://agentic-patterns.com/patterns/llm-map-reduce-pattern/)). (HIGH)
- **No custom multi-agent framework.** Claude Agent SDK + Skills + filesystem is the entire stack. LangGraph, CrewAI, AutoGen are explicitly rejected — they would re-implement what the SDK already provides and add a maintenance burden a single-maintainer OSS project cannot carry. (HIGH)
- **Slice 1: 5 hand-picked nodes, file-analyser only, human reviews quality.** No cross-cutting agents in slice 1. Acceptance is "the maintainer reads each enrichment and would not be ashamed to ship it." (HIGH)

## Hybrid vs pure-agent

**Decision: hybrid. Reject pure-agent.** (HIGH confidence)

Pure-agent ("let agents discover what to analyse") is rejected on three grounds:

1. **Determinism is a load-bearing property of an audit substrate.** The whole point of the substrate is that two runs against the same commit produce the same enumeration. An LLM choosing what to analyse re-introduces the i18n-class blind spot in a different shape: now the question is not "did the heuristic miss it?" but "did the agent decide it was worth looking at?" — a worse failure mode because it is per-run stochastic. The substrate ADR's PROBES.md acceptance criterion is *probe-driven validation*; that is incompatible with non-deterministic enumeration.

2. **Enumeration-as-LLM is uneconomic.** `odd-platform` has ~3,500 files. Letting an agent walk and decide-to-analyse produces O(N) LLM calls just for the walk, before any enrichment happens. Tree-sitter does the walk in seconds, deterministically, for $0. The agent budget belongs on enrichment, not on rediscovering the file tree.

3. **Stable IDs are the join key for everything downstream.** Every scanner, every gate, every navigation rollup keys off `{repo} {lang} {package} {kind}:{descriptor}`. Pure-agent loses that — the agent generates labels its own way, and now the doc-linkage / scanner-query / cross-pillar reuse story collapses. SCIP's own retrospective on LSIF's opaque-ID pain is the warning ([Sourcegraph, *Announcing SCIP*](https://sourcegraph.com/blog/announcing-scip)).

The hybrid contract is therefore:

| Layer | Owned by | What it produces | Determinism |
|---|---|---|---|
| **Scaffold** | tree-sitter extractor (`lineage/_extractor/`, today) | `nodes.jsonl` + `edges.jsonl` + `manifest.yaml` + structural rollups | Fully deterministic per commit |
| **Enrichment** | LLM agents (Claude Agent SDK subagents) | Per-node `understanding/{slug}.md` sidecars + cross-cutting aggregates | Per-call stochastic; outputs validated against schema; cached on `(node-id, scaffold-hash, prompt-version)` |

Enrichment is **additive**: a node can exist in scaffold without enrichment (the rollup just shows "no enrichment yet"), but no node can exist in enrichment without scaffold. This preserves the "scaffold is the truth of what exists" invariant.

The substrate ADR's revision-2 already commits to scaffold-only delivery; agentic enrichment is a Phase 2.5 layer on top of the existing scaffold, not a replacement.

## Ontology schema (per-node fields)

Per-node enrichment is one Markdown file per node at `lineage/{repo}/understanding/{node-id-slug}.md`. The file shape:

```markdown
---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.controller controller:AlertController"
node_kind: controller
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.1.0
model: claude-opus-4-7
enrichment_status: complete | partial | stale | failed
confidence_overall: HIGH | MEDIUM | LOW
---

# AlertController — semantic understanding

## understanding
2-4 sentences in plain English: what this code does, what business
behaviour it represents, how it fits into the surrounding feature.
A maintainer should be able to read this and have a working mental
model without opening the file.

## concepts
- entities: [Alert, AlertChannel, AlertConfig, DataEntity]
- operations: [list-alerts, change-alert-status, configure-alert-recipients]
- invariants: [alert ownership inherited from data-entity ownership]
- audiences: [data-platform-operator, data-entity-owner]

## dependencies_semantic
What this code conceptually depends on, distinct from syntactic imports:
- requires-feature: data-entity-ownership (LSN may break alert visibility)
- requires-config: notifications.* (channel routing)
- requires-runtime: spring-security context (filters by current user)

## tests_coverage_semantic
- covered_behaviours: [list, status-change]
- uncovered_behaviours: [recipient-config, escalation, snooze]
- test_files: [AlertControllerTest.java#testListAlerts, ...]
- gaps: |
    No test exercises the recipient-config path; the test suite
    only verifies list/status. recipient-config is the path most
    likely to break on a Spring upgrade.

## docs_link_semantic
- declared_docs: [features/alerts/overview]   # from @docs annotation
- inferred_docs: [features/alerts/configuration]  # agent-suggested, low confidence
- doc_drift_findings:
  - "Doc says 'alerts configurable via UI'; controller accepts only
     read + status-change. Configuration goes through a different
     controller (AlertConfigController). DOC-NNN candidate."

## implicit_adrs
- "Alert visibility is filtered by Spring Security at controller layer,
   not at repository layer. This means a service-layer caller bypassing
   the controller would see all alerts. Implicit decision: trust the
   controller layer for authz; do not duplicate at repo layer."
- "Status-change is a single PATCH endpoint, not a state-machine
   POST per transition. Implicit decision: simple two-state model
   (open/closed); rejecting richer state machines."

## bugs_limitations_corner_cases
- "On 10K+ alerts, list endpoint returns full set without pagination
   (verified by reading findAll signature). Performance gotcha for
   large platforms — file as backlog item if unconfirmed."
- "Status change does not emit a domain event; downstream notification
   channels are not informed. Operators expect a 'changed' event;
   none exists."

## sources
- file:line citations for every claim above:
  - understanding ← AlertController.java:1-95
  - concepts.entities.Alert ← Alert.java:1 (referenced)
  - implicit_adrs.[0] ← AlertController.java:34 (@PreAuthorize)
  - bugs_limitations.[0] ← AlertController.java:51 (no Pageable param)

## confidence_per_field
- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: MEDIUM (runtime-deps are inferred)
- tests_coverage_semantic: HIGH (file-grep verified)
- docs_link_semantic: MEDIUM (inferred_docs is agent suggestion)
- implicit_adrs: MEDIUM (decisions inferred, not stated)
- bugs_limitations_corner_cases: HIGH (verified by file read)
```

**Field rationale (per the assignment's enumerated fields):**

| Field | Why include | Cite SoT |
|---|---|---|
| `understanding` | Cornerstone 1: discoverability without context. Future maintainer + future agent can plan against this without re-reading. | Plain-English summary tradition; CLAUDE.md's "WHY" preservation rule |
| `concepts` | The actual ontology layer. Concept-merger agent uses this to find equivalences across files. | Domain-Driven Design ubiquitous-language idea, narrowed; not OWL/RDF formal-ontology |
| `dependencies_semantic` | Distinct from `imports` edge. A `@Configuration` class semantically depends on environment variables it never imports. | Captures runtime / config / spring-profile coupling that static graph misses |
| `tests_coverage_semantic` | Tests pillar's first input. Maps test files to behaviours, surfaces gaps. | Covers the case `tests/` pillar will need at activation |
| `docs_link_semantic` | Two-tier: `declared_docs` from `@docs` annotation (deterministic), `inferred_docs` agent-suggested (validated by doc-gap reducer). | Backstage TechDocs `techdocs-ref` inverted (per substrate DOC-LINKAGE.md) |
| `implicit_adrs` | The big one. Most decisions in any codebase are encoded, never written. ADR-archaeologist agent reads these across files and surfaces clusters. | CLAUDE.md ADR section: "ADRs are reverse-engineered from code patterns" |
| `bugs_limitations_corner_cases` | Direct feed to `missing-limitations` scanner. The agent flags candidates; maintainer triages. | LSN-001 / LSN-002 class — caveats that should have been documented |
| `sources` | Gate 9 — every claim cites file:line. Without this, enrichment is unreviewable. | CLAUDE.md Gate 9, `feedback_factual_provenance.md` |
| `confidence_per_field` | Gate 9 — banned phrases ("probably", "likely") replaced with explicit confidence. Reducers can filter on confidence. | Same |

**Schema discipline:** the `understanding/{slug}.md` file is parsed by reducers as YAML frontmatter + Markdown sections with deterministic heading names. A reducer that fails to parse a section logs a follow-up; it does not silently fall back. (Map-reduce isolation contract — outputs must be validated, never absorbed lossy.)

**Deliberately not included:**

- **OWL / RDF / formal triples.** ODD's codebase is not a knowledge-base product; treating it as one wastes budget on tooling no agent will use. The `concepts` field is structured prose with light typing, not an RDF-N3 graph.
- **`call_graph_semantic`.** That belongs to Phase 3 of the substrate (cross-file `calls` edges via SCIP). Not enrichment territory.
- **`security_findings`.** Joern's territory; security-flavoured analysis is its own pillar later.
- **`change_history`.** Git already has this; no need to mirror.

## Agent set

Six agents, all defined as Claude Agent SDK `AgentDefinition` entries ([Anthropic, *Subagents in the SDK*](https://code.claude.com/docs/en/agent-sdk/subagents)). The orchestrator is a Python driver in `lineage/_extractor/` that fans out via the SDK's `agents={}` parameter and the Agent tool.

| Agent | Phase | Input | Output | Tools | Refresh trigger |
|---|---|---|---|---|---|
| `file-analyser` | enrichment-1 (per-node) | One node ID + the source file | `understanding/{slug}.md` | `Read`, `Grep`, `Glob` | Node's source file changed (git diff) OR prompt version bumped OR enrichment_status != complete |
| `concept-merger` | enrichment-2 (reducer) | All `understanding/*.md`'s `concepts` blocks | `concepts.yaml` (deduplicated entity / operation / invariant catalog) | `Read`, `Glob` | Any per-node enrichment changed |
| `doc-gap` | enrichment-2 (reducer) | All `understanding/*.md`'s `docs_link_semantic` + `documentation/docs/SUMMARY.md` | `doc-gaps.md` (DOC-NNN candidates with citations) | `Read`, `Glob`, `Grep` | Any per-node enrichment changed OR docs SUMMARY changed |
| `adr-archaeologist` | enrichment-2 (reducer) | All `understanding/*.md`'s `implicit_adrs` + `adrs/` directory | `implicit-adrs.md` (clusters of related implicit decisions) | `Read`, `Glob` | Any per-node enrichment changed |
| `test-coverage-mapper` | enrichment-2 (reducer) | All `understanding/*.md`'s `tests_coverage_semantic` + repo's `**/*Test*.java` etc. | `test-map.yaml` (behaviour → test mapping; gap list) | `Read`, `Glob`, `Grep` | Any per-node enrichment changed OR test files changed |
| `feature-advisor` | query-time (interactive) | A natural-language question ("I want to add X — what's affected?") | A focused report citing `concepts.yaml` + `understanding/*.md` + `implicit-adrs.md` + `doc-gaps.md` | `Read`, `Grep`, `Glob` | On-demand only |

**Critical constraints from the SDK:**

- **Subagents cannot spawn subagents** ([SDK docs, "Subagents cannot spawn their own subagents"](https://code.claude.com/docs/en/agent-sdk/subagents#what-subagents-inherit)). This forces a strict 2-level hierarchy: driver → subagent. The reducers above are *separate driver-level invocations*, not nested. Each is its own orchestrator-workers pass: orchestrator reads all sidecars, dispatches one or more reducer subagent calls, writes aggregate.
- **Subagent context is fresh** — only the prompt string crosses the boundary. The driver MUST construct a complete prompt: node ID + source file path + scaffold edges-from-this-node + the schema spec.
- **`background: true`** is available — long enrichment passes (e.g., 100 nodes) should be background-mode by default with a polling/notification driver.
- **Per-subagent `model` override** — `file-analyser` runs Sonnet for cost; `adr-archaeologist` runs Opus for synthesis quality (LocAgent's split-by-model insight, [LocAgent paper](https://aclanthology.org/2025.acl-long.426.pdf)).
- **`maxTurns`** caps cost. `file-analyser`: 8 turns (read + grep + write). `adr-archaeologist`: 25 (multi-file synthesis).

**Agent prompt skeleton (file-analyser):**

```text
You are the FILE-ANALYSER agent for the ODD code-lineage substrate.

NODE: {node_id}
PATH: {file_path}
KIND: {node_kind}
SCAFFOLD-EDGES (this node's syntactic neighbours):
  imports: [...]
  imported-by: [...]
  exposes: [...]
  configures: [...]

YOUR JOB:
Read the source file at PATH end-to-end. Cross-reference its
imports + exposes + configures by reading them when material to the
node's role. Then emit a Markdown enrichment file at
`lineage/{repo}/understanding/{slug}.md` matching this schema:
  {paste of the schema from "Ontology schema" section above}

QUALITY BAR (per ODD CLAUDE.md):
- Every claim cites file:line in the `sources` block. No exceptions.
- Banned phrases: "probably", "likely", "should", "looks right",
  "presumably". Replace with HIGH/MEDIUM/LOW confidence + the citation.
- If you cannot verify a field, write `confidence: LOW` + a reason.
  Do NOT fabricate.
- Length budget: ~300-500 words of substantive content. Not a novel.
- If the file is trivial (e.g., a config-only YAML), produce a
  trivial enrichment — do not pad.

TOOLS YOU HAVE:
  Read, Grep, Glob.
TOOLS YOU LACK:
  Edit, Write (you cannot modify source code), Bash (no shell).

EXIT:
  Write the file via the Write tool to the path above. Reply with
  the absolute path you wrote and a 1-line summary of confidence.
```

The reducer agents have analogous prompts: input is "all per-node sidecars under `lineage/{repo}/understanding/`"; output is an aggregate file at a fixed path; tools are `Read + Glob + Grep + Write`.

## Storage layout

```
lineage/
  README.md                              -- existing
  _extractor/                            -- existing tree-sitter scaffold (Phase 4 shipped)
    pyproject.toml
    src/lineage_extractor/
      cli.py
      extractors/                        -- per-axis extractors (existing)
      rollups/                           -- structural rollups (existing)
      enrichment/                        -- NEW: agent driver
        __init__.py
        driver.py                        -- orchestrator: reads nodes.jsonl, dispatches subagents
        prompts/
          file_analyser.md               -- the prompt skeleton above
          concept_merger.md
          doc_gap.md
          adr_archaeologist.md
          test_coverage_mapper.md
          feature_advisor.md
        cache.py                         -- (node_id, scaffold_hash, prompt_version) cache
        validators.py                    -- schema parsers for sidecars
  odd-platform/
    manifest.yaml                        -- existing; add `enrichment` section
    nodes.jsonl                          -- existing; unchanged
    edges.jsonl                          -- existing; unchanged
    rollups/                             -- existing structural rollups
      ui-shell.md
      controllers.md
      ...
    understanding/                       -- NEW: per-node enrichment, one file per node
      odd-platform__java__controller__AlertController.md
      odd-platform__ts__locales__bootstrap__i18n.md
      odd-platform__java__config__props__GenAIProperties.md
      ...
    concepts.yaml                        -- NEW: concept-merger output
    doc-gaps.md                          -- NEW: doc-gap output (DOC-NNN candidates)
    implicit-adrs.md                     -- NEW: adr-archaeologist output
    test-map.yaml                        -- NEW: test-coverage-mapper output
    enrichment.log                       -- NEW: agent-call audit log (model, tokens, cost, prompt_version)
  odd-collectors/
    {same structure}
  odd-specification/
    {same structure}
```

**Why per-node sidecars (not inline JSONL, not aggregated rollup):**

| Option | Diff size on single-node refresh | Discoverability | Verdict |
|---|---|---|---|
| Inline in `nodes.jsonl` | Whole-file diff (line moves) | Worst — JSON inside JSON | Reject — kills `nodes.jsonl`'s diffability invariant |
| Aggregated `understanding.md` (one big file) | Whole-file diff | Decent | Reject — same as above; single agent run produces 100 KB diff |
| **Per-node sidecar** | One file added/changed | Best — `node-id-slug` is greppable | **Accept** |

**Slug generation:** `node-id-slug = node_id.replace(' ', '__').replace('.', '_').replace(':', '__').replace('/', '_')`. Stable, reversible, filesystem-safe.

**`manifest.yaml` enrichment block:**

```yaml
enrichment:
  driver_version: 0.1.0
  prompt_versions:
    file_analyser: file-analyser/0.1.0
    concept_merger: concept-merger/0.1.0
    doc_gap: doc-gap/0.1.0
    adr_archaeologist: adr-archaeologist/0.1.0
    test_coverage_mapper: test-coverage-mapper/0.1.0
  models_used:
    file_analyser: claude-sonnet-4-7
    adr_archaeologist: claude-opus-4-7
    {others}
  last_enriched_commit: ede5d277
  enriched_node_count: 47
  total_node_count: 395
  enrichment_coverage: 11.9%
  total_cost_usd: 3.42
  cache_hit_rate: 0.62
```

**Cache invariant:** an enrichment is reused iff `(node_id, scaffold_hash_of_file, prompt_version, model)` matches. Any change to the source file's hash, the prompt template, or the model invalidates. Cache lives in `lineage/{repo}/.enrichment-cache/` (gitignored).

**How agents write back:** the driver invokes the SDK's `query()` with `agents={...}` defined; the subagent writes its sidecar via the `Write` tool (which the subagent has allowed); the driver verifies the file appeared, parses it through `validators.py`, and if invalid logs to `enrichment.log` and re-queues with a corrective prompt (single retry, then mark `enrichment_status: failed` and continue). No "writer skill" — the SDK already gives the subagent file-write capability when `Write` is in its `tools` list.

## Composition with existing 5-axis substrate

| Axis | Today (scaffold) | Under hybrid (scaffold + enrichment) |
|---|---|---|
| `ui_routes` | **Keep.** Extracts route nodes from `routes/*.ts`. Determinism load-bearing. | **Enrich** each route node with file-analyser → `understanding/`. Concept-merger groups routes by feature. |
| `ui_shell` | **Keep.** The i18n-class fix; closes blind spot. | **Enrich** each shell-bootstrap and shell-widget. file-analyser surfaces "what does this widget do, who consumes it." |
| `controllers` | **Keep.** REST controller enumeration. | **Enrich** each controller. test-coverage-mapper maps controllers to tests. doc-gap maps controllers to feature pages. |
| `openapi_tags` | **Keep.** Tag → operation truth from `openapi.yaml`. | **No per-node enrichment** (tags are too coarse to enrich individually). Instead, tags become a *grouping key* for controller enrichments. |
| `config_prefixes` | **Keep.** YAML prefix → consumer mapping. | **Enrich** each prefix node. file-analyser surfaces "what does this config block control"; doc-gap maps to configuration pages; adr-archaeologist surfaces implicit defaults. |

**No axis is deprecated.** Enrichment is purely additive on top of every existing axis.

**New axes added by enrichment** (not tree-sitter axes — these are axes that emerge *from the enrichment data*):

- `concepts` — derived from concept-merger reducer, not extracted by scaffold. Lives in `concepts.yaml`.
- `implicit_adrs` — derived from adr-archaeologist reducer.
- `doc_gaps` — derived from doc-gap reducer.
- `test_gaps` — derived from test-coverage-mapper reducer.

These are **emergent axes** — they have no scaffold counterpart because they cannot be extracted deterministically. They are what enrichment exists *for*.

**Phase 2 axes from substrate ADR (`sdk_builders`, `bean_factories`, `ws_sse_channels`):** these will be added to scaffold first (deterministic enumeration), then enriched after a per-axis bootstrap PR. Same pattern as the MVP axes. The hybrid model means the substrate ADR's phase plan does not change — Phase 2 still ships scaffold-first; enrichment for those nodes is an additional follow-up.

## First slice (smallest end-to-end vertical)

**Slice 1: `file-analyser` over 5 hand-picked nodes from the existing odd-platform scaffold. No reducers. Maintainer reviews quality.**

**Specific files (all confirmed present in `lineage/odd-platform/nodes.jsonl` or trivially extractable):**

1. **`odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/AlertController.java`**
   - Node: `odd-platform java org.opendatadiscovery.oddplatform.controller controller:AlertController`
   - Kind: `controller`
   - Why: Already on the i18n / undocumented-features radar; has tests; has docs; rich alert-domain semantics; tests its `understanding` + `dependencies_semantic` + `implicit_adrs` fields.

2. **`odd-platform-ui/src/locales/i18n.ts`**
   - Node: `odd-platform ts odd-platform-ui/src/locales bootstrap:i18n`
   - Kind: `ui-shell-bootstrap`
   - Why: The canonical i18n-class case from LSN-005. Tests that the agent picks up the 6-language wiring + the absence of doc coverage (current rollup says "no @docs annotation"). Slice 1 should produce a `doc_gaps` finding for this file.

3. **`odd-platform-api/src/main/resources/application.yml`**
   - Node: scaffold has it as a `file` node; the `config_prefixes` axis decomposes it into prefix-level nodes. Pick **one prefix node**: `odd-platform yaml resources props:attachments` (or the equivalent ID — check nodes.jsonl).
   - Kind: `config-properties-class` or similar
   - Why: Tests that the agent reads YAML + finds the consumer + cross-references to docs. LSN-001 (attachment ephemeral default) lives here. Should surface "S3 default = local-fs ephemeral, with doc warning location" or flag the absence.

4. **`documentation/docs/data-discovery/attachments.md`** *(read-only — agent reads this when enriching the attachments config node, not as a node itself)*
   - This is **not** a slice-1 enrichment target; it is the *cross-reference* the file-analyser uses when enriching `application.yml`'s `attachments` prefix. Confirms that the agent walks scaffold → docs link.

5. **`odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/MinioConfig.java`** *(or whichever bean-factory class exists for object-storage; if MinioConfig doesn't exist, substitute the closest current bean-factory in nodes.jsonl)*
   - Node: `odd-platform java org.opendatadiscovery.oddplatform.config bean:minioClient`
   - Kind: `spring-bean-factory`
   - Why: Tests the bean-factory enrichment — should surface LSN-002 (region unset) as `bugs_limitations_corner_cases` if the `.region(...)` line is still missing in the slice's commit. This is the canary for "does the enrichment catch what scanners missed?"

   **NOTE:** scaffold today (extractor v0.1.0) has only the 5 MVP axes — `bean_factories` is a Phase 2 axis. If `MinioConfig.java` is not yet a node, slice 1 substitutes a `controller-method` from `AlertController` instead, keeping the count at 5. Concrete substitution decision lives in slice-1 implementation.

**Deliverable shape:**

```
lineage/odd-platform/understanding/
  odd-platform__java__controller__AlertController.md
  odd-platform__ts__odd-platform-ui_src_locales__bootstrap__i18n.md
  odd-platform__yaml__resources__props__attachments.md
  odd-platform__java__config__bean__minioClient.md
  odd-platform__java__controller__AlertController_listAlerts.md   (substitute slot)
lineage/odd-platform/manifest.yaml                                (enrichment block added)
lineage/odd-platform/enrichment.log                                (5 entries, model + tokens + cost)
lineage/_extractor/src/lineage_extractor/enrichment/driver.py      (new file, ~250 LOC)
lineage/_extractor/src/lineage_extractor/enrichment/prompts/file_analyser.md
lineage/_extractor/src/lineage_extractor/enrichment/cache.py
lineage/_extractor/src/lineage_extractor/enrichment/validators.py
```

**Acceptance criterion:**

1. **Maintainer reads each of the 5 sidecars.** For each: would they be ashamed to ship this enrichment as the project's stated understanding of the node? If yes → reject, log the failure mode as a prompt revision.
2. **Every claim in every sidecar cites file:line in `sources`.** Any claim without a citation = revise prompt to enforce.
3. **At least one `bugs_limitations_corner_cases` finding** is real and actionable (i.e., would become a backlog item if formally triaged).
4. **At least one `doc_gaps` candidate** is real (i.e., would become a DOC-NNN if formally triaged).
5. **The cost report (`enrichment.log` total)** is acceptable. Slice-1 budget: <$5 for 5 nodes. If a single node costs >$2, the prompt is wrong (either reading too much context or generating too much output).
6. **No reducer output** in slice 1 — concept-merger, doc-gap, adr-archaeologist, test-coverage-mapper are slice 2.

**What slice 1 does NOT do:**

- No batch-mode (single-node CLI invocation only).
- No cache (slice 2 problem — slice 1 measures cost without optimisation).
- No reducers — single per-node pass per file.
- No CI / autonomous loop — manual `python -m lineage_extractor enrich --node=<id>`.
- No GitHub-Actions integration.

**Slice 2 (after slice 1 ships and is reviewed):** add caching, batch-mode (`--all`), and the `concept-merger` reducer (the simplest reducer). Continue from there if slice 2 holds quality.

## Anti-patterns to avoid

1. **Building a custom multi-agent framework.** LangGraph, CrewAI, AutoGen are not needed. Claude Agent SDK + Skills + filesystem is the entire stack. ([Anthropic, *Building Effective Agents*](https://www.anthropic.com/research/building-effective-agents): "the most successful implementations weren't using complex frameworks or specialized libraries.") A single-maintainer OSS project cannot afford a framework upgrade treadmill on top of doc + code + tests.

2. **Letting agents enumerate the worklist.** Pure-agent rejected — see "Hybrid vs pure-agent" above. Determinism is the substrate's load-bearing property.

3. **Subagents that spawn subagents.** Architecturally impossible per the SDK ([SDK docs note: "Subagents cannot spawn their own subagents"](https://code.claude.com/docs/en/agent-sdk/subagents#what-subagents-inherit)). Any pattern requiring nested delegation is invalid.

4. **Free-form per-node output.** Map-reduce isolation contract requires constrained schemas ([*LLM Map-Reduce Pattern*](https://agentic-patterns.com/patterns/llm-map-reduce-pattern/) — "outputs cannot be free-form text, but rather defined enums, booleans, or structured JSON to prevent injection attacks during aggregation"). Per-node sidecar = YAML frontmatter + named Markdown sections, validated by `validators.py`.

5. **Optimistic enrichment without `sources`.** Gate 9 (factual provenance). An enrichment without file:line citations is unreviewable; it accumulates "looks-right" claims that scanners then trust. Banned phrases ("probably", "likely", "presumably", "looks right") in the prompt skeleton.

6. **Agent-as-canonical-source.** Enrichment is enrichment, not truth. The substrate scaffold is the truth of "what exists"; enrichment is "what we currently believe about it." A scanner finding that contradicts an enrichment trusts the scanner; a maintainer reading an enrichment that contradicts the code trusts the code. Enrichment is `enrichment_status: stale` whenever the scaffold node hash changes — and the file-analyser must re-run.

7. **One giant `understanding.md` per repo.** Already rejected in Storage layout — single-file aggregation kills diffability. Per-node sidecars only.

8. **Cross-node correlation in `file-analyser`.** Each `file-analyser` invocation is local to one node. Cross-node insights (concept equivalences, doc gaps, ADR clusters) are reducer territory. Mixing concerns in `file-analyser` produces stochastic, unbounded prompts.

9. **OWL / RDF / formal ontology theory.** ODD's ontology is a working tool, not a knowledge-product. Structured prose + light typing in `concepts` block is enough. Do not import academic-ontology vocabulary the maintainer will never want to read.

10. **Self-marking enrichment as `complete`.** The same Implementer-vs-Reviewer split that gates `/implement` and `/review` applies here: an enrichment is `review-ready` until a separate `/review` pass (or a maintainer eyeball) flips it to `complete`. Stochastic outputs MUST have a verification gate. (CLAUDE.md "Review (`/review`)" section.)

11. **Enrichment as a CI step on every PR.** Same reason as substrate ADR PITFALLS P5: PR diff floods. Enrichment runs on `/scan enrich` invocation, not on every push. Manual or scheduled, never PR-triggered.

12. **Skipping the cache.** A single `file-analyser` run on a 100-node batch is ~$30 (estimated). Without `(node_id, scaffold_hash, prompt_version, model)` caching, every refresh re-pays. Cache from slice 2 onwards is non-negotiable.

## Sources

**Primary architectural references:**

- [Anthropic, *Building Effective Agents*](https://www.anthropic.com/research/building-effective-agents) — orchestrator-workers pattern; "simple, composable patterns" thesis; rejection of heavy frameworks.
- [Claude Agent SDK, *Subagents in the SDK*](https://code.claude.com/docs/en/agent-sdk/subagents) — `AgentDefinition` schema (`description / prompt / tools / model / skills / memory / maxTurns / background / effort / permissionMode`); "Subagents cannot spawn their own subagents"; context-isolation contract; programmatic-vs-filesystem definition.
- [Awesome Agentic Patterns, *LLM Map-Reduce Pattern*](https://agentic-patterns.com/patterns/llm-map-reduce-pattern/) — isolation contract; constrained-output schema requirement; deterministic-vs-LLM reducer trade-off.
- [LocAgent: Graph-Guided LLM Agents for Code Localization (ACL 2025)](https://aclanthology.org/2025.acl-long.426.pdf) — planner / executor / verifier split; graph-as-scaffold for LLM walks; per-agent model selection (e.g., Qwen-2.5-Coder for executor, larger for planner).

**Substrate prior-art (already cited in `code-lineage-substrate/`):**

- [SCIP (Sourcegraph)](https://github.com/sourcegraph/scip) — `Document` + `Symbol` dual-axis design; rationale for human-readable IDs.
- [Sourcegraph, *Announcing SCIP*](https://sourcegraph.com/blog/announcing-scip) — LSIF opaque-ID retrospective.
- [tree-sitter](https://tree-sitter.github.io/) — multi-language declarative AST queries.
- [Backstage TechDocs](https://backstage.io/docs/features/techdocs/creating-and-publishing/) — `techdocs-ref` annotation pattern (inverted in our scheme: source-side annotation, doc-side validator).

**Workspace context:**

- `<odd-team>/CLAUDE.md` — Quality Bar gates; Velocity is the partner of Pride; Pre-authoring stance check; the "scattered intent" failure mode.
- `<odd-team>/adrs/drafts/code-lineage-substrate.md` — substrate ADR revision 2; phase plan; the 5-axis MVP; the i18n trigger incident.
- `<odd-team>/adrs/drafts/research/code-lineage-substrate/SCHEMA.md` — node ID shape; 7-edge taxonomy; JSONL-vs-Markdown discipline.
- `<odd-team>/adrs/drafts/research/code-lineage-substrate/SUMMARY.md` — phase-1/phase-2/phase-3 sequencing; "MVP acceptance is probe-driven, not coverage-%-driven."
- `<odd-team>/lineage/odd-platform/manifest.yaml` — current scaffold state (extractor v0.1.0, 395 nodes, 479 edges, 5 axes shipped).
- `<odd-team>/lineage/odd-platform/rollups/ui-shell.md` — concrete sample of what scaffold rollups look like today (the join-point for enrichment).
- `<odd-team>/retrospectives/LSN-001-attachment-ephemeral-default.md`, `LSN-002-minio-region-unset.md` — the silent-SDK-default class, which `bugs_limitations_corner_cases` is designed to surface.

**Rejected sources (named so future maintainers don't re-litigate):**

- LangGraph, CrewAI, AutoGen, MetaGPT, OpenAI Swarm, BeeAI — explicitly rejected in *Anti-patterns to avoid* #1. Their feature surfaces (graph state, role DSLs, swarm-style hand-off) are not needed when the Claude Agent SDK provides subagents + filesystem-state primitives.
- OWL / RDF / formal ontology vocabulary — explicitly rejected in *Anti-patterns to avoid* #9. ODD's ontology is a working tool; structured prose + light typing is enough.
- Joern Code Property Graphs — security-flavoured analysis; not in this proposal's scope (substrate ADR explicitly out-of-scope).
