# Approach — agentic code ontology for living codebases

A portable methodology for building a queryable, self-maintaining ontology of any non-trivial codebase, run by AI maintainers inside Claude Code. Originally built for Open Data Discovery (Java + Spring + React + TypeScript); applicable to any project with source code, documentation, and tests.

**Audience.** Two readers: (a) the human engineer of a new project who wants to bring this approach over without reinventing it; (b) Claude Code itself, invoked from that new project, pointed at this workspace, asked to bootstrap the same approach for a different stack.

**Scope of portability.** The METHODOLOGY ports: four-layer architecture, sidecar schema, reducer subagent shapes, entry-point principle, feature-flow composition, 4-class test matrix, case-law format, probe protocol, Quality Bar rules. The CONCRETE INSTANCES do not: per-language tree-sitter extractors, project-specific node kinds (controllers vs CLI commands vs GraphQL resolvers), entry-point classes (Django views vs Express handlers vs Lambda functions), the case-law file contents (LSN incidents are project-specific), the canonical concept page. Copy the framework; author the instances.

**Revision history.** Rev 1 (2026-05-12): initial portability surface with three-layer architecture (substrate / per-node enrichment / reducers). Rev 2 (2026-05-19): fourth layer added — feature-anchored synthesis with entry-point traversal, feature-flow composition, and 4-class test matrix. Trigger: LSN-017 (per-node scan cannot see cross-layer user effects). Rev 3 (2026-05-19): Layer 0 added — `system-mission.md` mission anchor produced once per substrate scan by the `domain-extractor` subagent; supplies the user-observable pillar gestalt that the rev-2 failure mode lacked. Trigger: post-batch-I review (60 sidecars → only 8 features, all bug-anchored). Rev 4 (2026-05-20): **Stress Protocol** bolted into Layer 2 — every file-analyser invocation now interrogates the code (boundary cases, name-behavior drift, ordering semantics, auth-mode posture, resource boundaries) instead of describing it; analyser-emitted probe-skeletons become first-class artefacts; the coverage metric splits into "static enrichment coverage" (vanity, kept for trend continuity) vs "stress_verified_pct" (the honest axis). Trigger: LSN-019 (the `listMostPopular` drift — method named "popular" returns the OLDEST 30 by creation order because the SQL has no `ORDER BY count` clause; the methodology had transcribed the surface meaning as truth for weeks). Anchor ADRs: `adrs/drafts/feature-anchored-ontology.md` (rev 2-3) + rev-4 update pending.

---

## 1. Mission — what this gives you

A single coherent answer to eight questions any non-trivial codebase eventually faces:

1. **Onboarding** — new dev (human or AI) walks in and gets a working mental model of dependencies, concepts, and approaches from versioned artefacts, not tribal knowledge.
2. **Impact analysis** — "I want to add X" returns a structured map: affected concepts, related controllers/services, doc pages that must update, tests that must extend, ADRs that constrain the change.
3. **ADR archaeology** — implicit decisions ("we always do Y, just never wrote it down") surface as ADR candidates from cross-file pattern emergence. Drift from existing ADRs surfaces as code-vs-decision gaps.
4. **Test-coverage map** — every code behaviour declared on the per-node sidecar has a known test (covered) or a known absent test (gap, ranked by criticality). Now extended per feature × test-class (unit / integration / performance / security).
5. **Security + performance posture** — sparse per-file signals aggregate into per-concept assessments: this feature's auth posture, its hot paths, its known gaps — with file:line evidence.
6. **Doc-drift detection** — every doc-link claim is bidirectionally verified against the live published doc. Code says X, doc says Y; the substrate surfaces both. Documentation is the audit target, not the source of truth.
7. **Feature-flow composition** *(layer 4, rev 2)* — per-feature user-observable behaviour is composed from entry-point sidecar chains. Cross-layer multipliers (UI dispatch-multiplicity × backend per-call delta) land as feature-drift entries, not as buried single-sidecar findings. The view_count doubling bug (`retrospectives/LSN-017`) is the canonical case the layer catches.
8. **Per-feature control matrix** *(layer 4, rev 2)* — every feature has a 4-cell row: unit / integration / performance / security. Empty cells are uncontrolled dimensions; covered cells are pinned. A feature can be fully unit-tested and still fail integration (view_count doubling); pass integration and fail performance (sequential scans at scale); pass for the happy actor and fail for the adversarial one. The matrix forces explicit coverage along all four orthogonal axes.

The outcome is **lineage of meaning, not paths, anchored on user-observable features** — see `retrospectives/LSN-016` (heuristic-vs-agentic pivot) and `retrospectives/LSN-017` (per-node-vs-feature-anchored pivot) for the case-law that forced this framing.

---

## 2. Why this approach exists (the failure modes it solves)

Three failure modes the approach exists to defeat. All have case-law in `retrospectives/`.

**Failure A — tribal-knowledge decay** (pre-LLM operating mode). Architecture, conventions, corner-cases live in maintainers' heads. Doc drifts; new joiners reinvent. ADRs get written retroactively if at all. Most projects ship knowledge-loss as a feature.

**Failure B — heuristic-only enumeration** (early pre-LLM tooling, the trap LSN-016 calls out). A tree-sitter / regex / annotation walker produces syntactically-correct nodes ("here is every `@RestController`") but zero semantic content ("what is this controller FOR? where does the doc disagree? what bugs lurk?"). It misses code that does the same thing with a different annotation. It produces no `implicit_adrs`, no `caveats`, no divergence findings. **A heuristic substrate that calls itself lineage is the antipattern.**

**Failure C — descriptive enrichment without interrogation** *(rev 4, LSN-019)*. The methodology adds Layer 2 (per-node enrichment) on top of the substrate and assumes the LLM will surface anything worth surfacing. **But an LLM reading code defaults to transcription**: it sees `size: 30` and writes *"shows top 30"*; it sees `listMostPopular` and writes *"orders by popularity"*; it sees `@PreAuthorize("hasRole('ADMIN')")` and writes *"admin-only"*. The surface description is correct AT THE CENTER and wrong AT THE BOUNDARIES — which is exactly where operators get hurt. The canonical incident: `tagService.listMostPopular` was transcribed as *"returns most-popular tags"* because the method name and the count-CTE in the SQL suggest popularity ordering; the actual JOOQ chain has no `ORDER BY count` clause, so the SQL returns rows in natural (creation) order; the operator sees the OLDEST 30 tags labelled *"Top Tags"*. The wrong claim shipped with `confidence: HIGH` for weeks because the methodology never generated the question *"the SQL has a count column — does the OUTER select actually `ORDER BY count DESC`?"*. A senior engineer reading the same code generates that question instantly. **Failure C is the agent-tooling analogue of Failure B** — one layer up: where Failure B is structurally complete + semantically empty (heuristic walker emits node, no meaning), Failure C is semantically populated + interrogatively empty (LLM emits sidecar, no boundary thinking). The fix shape is the same in both cases: bake question-generation into the layer itself, mechanically, on every invocation. Failure C's fix is the **Stress Protocol** (section 5, rule 13 + section 14).

The approach defeats all three by **layering with interrogation**: heuristic gives stable IDs cheaply (the scaffold); LLM agents enrich those IDs with semantic content (the meat); **the analyser runs a Stress Protocol on every node to interrogate boundaries, name-behavior drift, ordering semantics, auth-mode posture, and resource limits — generating runnable probe-skeletons when the answer requires runtime**; reducers turn per-file signals into emergent cross-file findings (the payload); the coherence-sweep catches cross-artefact contradictions. The layering matches the 2024-2025 industry consensus (LazyGraphRAG / Aider repo-map / Sourcegraph-deprecating-embeddings / KG-CodeGen-May-2025) and was validated through the substrate ADR's research pass — see `adrs/drafts/research/agentic-code-ontology/` for the long-form. The interrogation discipline is the rev-4 contribution — see section 14.

---

## 3. The four-layer architecture

| Layer | Lives in | What it produces | Why this layer exists |
|---|---|---|---|
| **1. Substrate** (deterministic) | `lineage/_extractor/` Python driver; tree-sitter parsers per language | `nodes.jsonl` (one node per code entity) + `edges.jsonl` (containment, calls, configures, exposes, mounts, references) + `manifest.yaml` (commit anchor, axis versions) | Stable IDs are the join key for everything downstream. Deterministic enumeration is cheap and never hallucinates a node. A heuristic walker is the ONLY layer that should be heuristic. |
| **2. Per-node enrichment** (agentic, with **Stress Protocol** in rev 4) | `.claude/agents/file-analyser.md`; one Markdown sidecar per node at `lineage/{repo}/understanding/{slug}.md`; zero-or-more analyser-emitted probe-skeletons at `lineage/{repo}/probes/P-{NNN}.yaml` | Per-node `understanding`, `concepts`, `dependencies_semantic`, `tests_coverage_semantic` (with per-behaviour `test_class`), `docs_link_semantic`, `implicit_adrs`, `bugs_limitations_corner_cases`, **`stress_findings`** *(rev 4)*, `security`, `performance`, **`upstream_callers`**, **`downstream_side_effects`**, `sources`, `confidence_per_field` | A subagent reads ONE node end-to-end, walks 1-hop neighbours when material, WebFetches the live published doc for any claimed link, **runs the Stress Protocol on every trigger detected in the code (tunables / name-behavior pairs / orderings / auth gates / resource boundaries — each with a fixed question list, each question answered via trace-answer with `STATIC-INFERRED` evidence, OR probe-answer with a runnable skeleton emitted under `probes/`, OR reference-answer pointing at another sidecar)**, and emits a sidecar a maintainer would be proud to ship. Each sidecar carries the call-graph references (upstream + downstream) and user/externally-observable consequences, enabling layer-4 composition. Per-file context window stays manageable; semantic content + interrogation are the deliverables. Schema v0.4.0 (rev 4). |
| **3. Cross-file reducers** (agentic, cross-file) | `.claude/agents/{concept-merger,adr-archaeologist,doc-gap-finder,test-coverage-mapper,feature-advisor}.md`; outputs at `lineage/{repo}/{concepts.yaml,implicit-adrs.md,refactoring-scopes.md,doc-gaps.md,test-map.yaml,feature-walks/}` | Cross-sidecar emergence: shared concepts; recurring ADR patterns; doc divergences; test gaps; impact assessments for proposed features | Single-file enrichment can't see patterns. The reducer steps back across all sidecars + canonical docs and surfaces what no single sidecar could. The 18-sidecar "DISABLED-mode bypass" finding in ODD's `investigator-log.md` is the proof: emergence only the cross-product can produce. |
| **4. Feature-anchored synthesis** (agentic, cross-layer) | `.claude/agents/feature-flow-builder.md`; output at `lineage/{repo}/feature-flows.yaml` | Per-feature observed-vs-expected user-observable behaviour, composed from entry-point sidecar chains. Each entry: contributing_nodes, amplification_factor, cross-layer drift annotations, and a 4-class test matrix (unit / integration / performance / security). | Reducers compose by *concept*. The feature layer composes by *user-observable boundary*. The view_count doubling bug (LSN-017) cannot be surfaced by either layer 2 or layer 3 alone — the cross-layer product (UI dispatch-multiplicity × backend per-call delta) lives only at the system's external boundary, which is layer 4's home. |

**Rule of layering**: lower layers never depend on higher layers. The substrate doesn't read sidecars. Sidecars don't read each other (per-node scope only — but they DO record cross-references for layer 4). Cross-file reducers don't read source code (they read sidecars). Feature-flow synthesis reads sidecars + reducer outputs + the substrate's edge graph (it does not re-read source code). The flow is one-way; the dependencies are clear.

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

**Entry-point classes** *(rev 2)* — a subset of node kinds that mark **where the system meets an external observer**. Entry-points are the unit of analysis for layer-4 feature synthesis; each batch picks 1-3 entry points and traverses downstream. Canonical entry-point classes:

| Class | Examples |
|---|---|
| UI route mount | React route handlers, Next.js pages, Vue components on a router |
| UI handler | Button onClick, form onSubmit, drag-drop onDrop |
| REST operation | Each OpenAPI op regardless of caller; SOAP method; gRPC unary call |
| Scheduled job | Spring `@Scheduled`, Quartz job, Celery beat task, K8s CronJob |
| Webhook receiver | Inbound HTTP receiver for external events (AlertManager, Slack, S2S ingestion) |
| WAL/event listener | Replication-slot consumer, Kafka subscriber, Redis pub/sub listener |
| SDK builder | AWS SDK builder, Boto3 client config, Azure SDK builder |
| Boot-time evaluation | `@PostConstruct`, `@Configuration` class evaluation, `application.yml` resolution |
| Test class | `test_axis`-classified test files (unit / integration / performance / security) |

**Add an entry-point class when a probe surfaces user-observable behaviour the substrate doesn't have a unit of analysis for.** Don't pre-design entry-point classes for cases the maintainer hasn't observed.

**Test files become a substrate axis** *(`test_axis`, rev 2)* — each test file is classified by content + naming: `@WebFluxTest`/`@SpringBootTest` + Testcontainers → `integration`; mock-heavy `@ExtendWith(MockitoExtension)` → `unit`; benchmark / EXPLAIN ANALYZE → `performance`; auth-mode-matrix / `*AuthorizationTest` → `security`. Untyped tests are themselves a coverage gap. The classification feeds the per-feature 4-class matrix in layer 4.

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
- covered_behaviours:
  - behaviour: "<one sentence>"
    test_class: unit | integration | performance | security    # rev 2
    test_files: [<paths>]
- uncovered_behaviours:
  - behaviour: "<one sentence>"
    test_class: unit | integration | performance | security    # rev 2
    criticality: CRITICAL | HIGH | MEDIUM | LOW
    gap_id: TEST-GAP-NNN
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

## stress_findings                                              # rev 4 — interrogation phase
# Five trigger categories — every triggered question gets an answer (trace / probe / reference).
# Empty categories are EXPLICIT `[]` so "I checked; no triggers" is distinct from "I forgot".
stress_findings:
  tunables:                       # numeric constants, defaults, limits, page sizes, timeouts, retries
    - location: "<file:line>"
      name: "<constant or @Value name>"
      value: "<the value>"
      questions:
        - q: "What at N > tunable?"
          a: "<trace OR PROBE-NEEDED OR REFERENCE>"
          confidence: STATIC-INFERRED | PROBE-NEEDED | REFERENCE
          evidence: "<file:line OR probe_id OR node_id>"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "..."
          confidence: STATIC-INFERRED | PROBE-NEEDED | REFERENCE
          evidence: "..."
  name_behavior_pairs:            # method names, endpoints, doc promises
    - name: "<method or endpoint>"
      promise: "<what the name promises>"
      implementation: "<what the code actually does, traced end-to-end>"
      drift: NONE | MINOR | DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "<one sentence, if drift>"
      confidence: STATIC-INFERRED | PROBE-NEEDED | REFERENCE
      evidence: "..."
  orderings: [...]                # every ORDER BY / LIMIT / paginate / sort site
  auth_gates: [...]               # every endpoint × 4 auth modes × unauthenticated × wrong-role
  resource_boundaries: [...]      # every Transactional / lock / cache / idempotency site
  probes_emitted:                 # audit trail — probe skeletons written under probes/
    - probe_id: P-NNN
      question: "<the stress question the probe targets>"
      probe_path: "lineage/{repo}/probes/P-NNN.yaml"
  stress_summary:                 # honest at-a-glance metric
    triggers_total: <N>
    questions_total: <N>
    answers_static_inferred: <N>
    answers_probe_needed: <N>
    answers_reference: <N>
    answers_probe_verified: <N>    # populated by probe-runner on resolution
    drift_flags: <N>               # name_behavior_pairs with drift != NONE

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

## upstream_callers                                              # rev 2 — feature-flow input
For each call-site that reaches this node, record the entry-point context:
- entry_point: "<axis>:<descriptor>"   # e.g. "ui_route:/dataentities/{id}/overview"
  caller_node: "<node_id of immediate caller>"
  multiplicity_per_trigger: <N> | unresolved
  evidence: "<file:line>"
  observation_class: ui-call | rest-call | scheduled-trigger | webhook | wal-event | sdk-call | boot-eval

If a caller is known but not yet enriched, record a REFERENCE entry with `unresolved: true`
to be filled on a later pass. References are first-class — they accumulate the partial picture.

## downstream_side_effects                                       # rev 2 — feature-flow input
For each user-observable or externally-observable consequence of this node's execution:
- side_effect_class: db-write | activity-emit | external-call | sse-push | cache-mutate | log-emit | metric-emit | page-render | header-set | redirect-issue
  description: "<one sentence — what an external observer sees change>"
  evidence: "<file:line>"
  cardinality_per_call: <N> | <conditional-expression>
  reachable_from_entry_points: ["<axis>:<descriptor>", ...]   # union across passes

If a downstream callee is not yet enriched, leave a REFERENCE entry with `unresolved: true`.

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
| `doc-gap-finder` | All sidecars' `docs_link_semantic` blocks; live doc URLs via WebFetch; canonical concepts page; **(rev 2)** feature-flows.yaml | `doc-gaps.md` | DOC-NNN candidates: broken URLs, missing anchors, code-doc drift, missing pages, coverage gaps, stale pages, **(rev 2)** feature-control-gaps (features uncontrolled along one or more axes whose doc page doesn't warn). |
| `test-coverage-mapper` | All sidecars' `tests_coverage_semantic` blocks; actual test files via Glob+Grep; **(rev 2)** feature-flows.yaml; `test_axis` substrate classifications | `test-map.yaml` | TEST-GAP-NNN candidates ranked by node criticality. **(rev 2)** Also dual-keyed by `per_feature` matrix: for each feature × test_class (unit / integration / performance / security), `covered` + `uncovered` + `verdict`. |
| `feature-advisor` | All sidecars + concepts.yaml + implicit-adrs.md + refactoring-scopes.md + doc-gaps.md + test-map.yaml + **(rev 2)** feature-flows.yaml + existing `adrs/`; live docs via WebFetch | `feature-walks/{date}-{slug}.md` | Query-time impact analysis. Maintainer asks "I want to add X — what's affected?" before writing code. |
| **`feature-flow-builder`** *(rev 2)* | All sidecars' `upstream_callers` + `downstream_side_effects` blocks; substrate's edge graph; concepts.yaml; `test_axis` classifications | `feature-flows.yaml` | Per-feature observed-vs-expected user-observable behaviour, composed from entry-point sidecar chains. `amplification_factor` where multipliers stack across layers; `cross_layer_drift` annotations; per-feature 4-class test matrix; cross-references to refactoring-scopes / doc-gaps / test-gaps that contribute. |

The six reducer outputs together form the **payload**. The substrate + sidecars are inputs to the payload; the payload is what a maintainer consumes day-to-day. `feature-flows.yaml` is the **product surface** — it expresses the system as users observe it, anchored on code-derived truth.

---

## 5. The non-negotiable rules

These are universal across projects. They appear in `file-analyser.md` and the reducer agents as "non-negotiable rules". Don't dilute them.

1. **Live URLs only for documentation.** A subagent's knowledge of project documentation comes from `WebFetch` results in the current session. Never from pretraining. `last_verified_status` is required on every doc-link entry; broken links surface as doc-gap findings rather than being silently coerced to "looks right".
2. **Code-anchor mandate (Gate 9).** Every claim in a sidecar has a `## sources` entry citing `file:line` (or doc URL + date + status). A claim with no anchor is rejected at validation. A claim whose anchor doesn't resolve is rejected.
3. **One sidecar per node per invocation.** No cross-node bleed. Walk neighbours for context, but emit the sidecar for the target node only. *(rev 2 — record cross-references in `upstream_callers` / `downstream_side_effects`; resolve them in later passes; never silently inline neighbour findings into the current node's body.)*
4. **No source code modification by file-analyser.** The subagent has `Read, Grep, Glob, WebFetch, Write` — no `Edit`, no `Bash`. Findings outside the current node's scope become tracked artefacts (commit-body notes / backlog items / upstream issue drafts), not patches.
5. **No absolute filesystem paths in committed artefacts.** Use repo-relative paths in `sources:` blocks. The artefacts get pushed to a public repository; personal home directories and internal hostnames must not leak.
6. **Banned phrases.** "probably", "likely", "should", "looks right", "presumably", "defensible", "canonical owner", "monorepo default", "safe to assume". Replace with `confidence: LOW + one-line reason` or `VERIFIED via {fetch/grep/read}`.
7. **Maintainer-curated entries survive refresh.** A `Maintainer notes` block in a sidecar; a `maintainer_curated: true` flag in `concepts.yaml` / `feature-flows.yaml`. The reducer preserves these across re-runs.
8. **Probe-driven acceptance, not coverage-%-driven.** A passing probe round means the substrate handles the categories you tested for; it does NOT mean exhaustive. See section 7.
9. ***(rev 2)* Code is truth; documentation is the audit target.** Features emerge from code-walk, never from a docs-derived catalog. Doc-gap-finder compares code-anchored feature facts to published docs; drift surfaces as DOC-GAP-NNN. The ontology cannot start from a feature list extracted from docs because the feature list must itself be derivable from code (and docs may be stale, inconsistent, or silent about features the code has — including bugs that produce user-observable effects). Case-law: `retrospectives/LSN-017`.
10. ***(rev 2)* Entry points are the unit of analysis.** Batch planning picks 1-3 entry points (not 5 random code nodes) and traverses outward. The same code is visited many times — that is the structural justification for the ontology. References act as placeholders during early passes; later passes flesh them. Re-visiting the same code from a new entry-point context is expected and welcomed.
11. ***(rev 2)* Features are controlled along four orthogonal axes.** Unit / integration / performance / security. A feature can be fully unit-tested and still fail integration (the canonical view_count case). The per-feature test matrix has a 4-cell row; empty cells are gaps, covered cells are pinned. Test classification is automatic from `test_axis` substrate annotations.
12. ***(rev 2)* Local-only execution — no remote or cloud infrastructure for any component of the methodology.** Every part of the ontology runs on the maintainer's workstation: substrate extractor, sidecar enrichment, reducers, probe execution, dynamic-verification mirror (when added), headless-browser probes, load injection, external-system mocks. **No remote VMs, no managed databases, no per-hour cloud bills, no hosted observability, no managed CI runners as part of the probe loop.** The methodology must not introduce a recurring infrastructure cost beyond the maintainer's existing Claude Code subscription and their own machine. Open-source local tooling only: docker-compose / podman-compose for the runtime mirror, Testcontainers + jOOQ + Postgres for ephemeral DB, Playwright / Puppeteer for headless-browser probes, k6 / wrk for load, WireMock / MockServer for external mocks. The dynamic-verification layer — when drafted as its own ADR — must declare this constraint as the load-bearing operational invariant.
13. ***(rev 4)* Interrogate, do not transcribe — the Stress Protocol is non-negotiable.** The file-analyser does NOT emit a sidecar without first running the Stress Protocol on the code it read. Five trigger categories — **tunables** (every hardcoded number / default / limit), **name-behavior pairs** (every method or endpoint whose name promises observable behavior), **orderings** (every `ORDER BY` / `LIMIT` / paginate / sort), **auth gates** (every endpoint × 4 auth modes × unauthenticated × wrong-role), **resource boundaries** (every `@Transactional` / lock / cache / idempotency site). Each trigger fires a fixed question list (see section 14 for the full catalogue). Each question is answered via ONE of: (a) **trace-answer** — the answer is in the code + 1-hop neighbours; record `confidence: STATIC-INFERRED` + `file:line` evidence; (b) **probe-answer** — answer requires runtime; the analyser writes a concrete runnable probe-skeleton under `lineage/{repo}/probes/P-{NNN}.yaml` (`emitted_by: file-analyser`, `status: pending-stress-protocol`); the sidecar records `confidence: PROBE-NEEDED` + the `probe_id`; (c) **reference-answer** — answer lives in another sidecar; record `confidence: REFERENCE` + the `node_id` of the sidecar that owns it. **No triggered question may be skipped.** A sidecar with `stress_findings.stress_summary.triggers_total == 0` on a node that visibly contains numeric literals, method-name verbs, endpoint annotations, ORDER BYs, or `@PreAuthorize` annotations is REJECTED. The methodology generates its own questions — it does not ask the maintainer to remember things. The Stress Protocol is what closes Failure C (section 2). Case-law: `retrospectives/LSN-019`. The file-analyser system prompt lives in `.claude/agents/file-analyser.md` at version `file-analyser/0.4.0` (or newer).
14. ***(rev 4)* Coverage is a stress-verified percentage, not a node-touched percentage.** The honest metric is `(STATIC-INFERRED + PROBE-VERIFIED) / total stress questions`. The vanity metric `(nodes_with_sidecar / total_substrate_nodes)` is kept for trend continuity but is NEVER the headline. A registry with 100% node-touched coverage and 0% stress-verified coverage is a registry of descriptive transcription — i.e. exactly the LSN-019 failure mode. The maintainer's reading of "X% coverage" must mean *"X% of operator-observable claims have been interrogated against the code or measured against the running system"*, not *"X% of nodes have some sidecar"*. The `coverage.py` reducer's dashboard renders both axes, with explicit framing distinguishing them.

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

**Step 3 — Identify your project's specific axes AND your entry-point classes.** Walk your codebase and answer two questions:

- *Specific axes* — what are the high-leverage SLICES, the kinds of code where a missing entry would be load-bearing? ODD's set is `controllers + openapi_tags + ui_routes + ui_shell + config_prefixes`. A Django project might pick `views + urls + management_commands + celery_tasks + settings_modules + migrations`. A Go service might pick `http_handlers + grpc_handlers + cmd_entrypoints + cobra_commands + config_consumers`.
- *Entry-point classes (rev 2)* — which of your nodes are the **user-observable boundaries** the system meets? UI route mounts, button onClick handlers, REST operations, scheduled jobs, webhook receivers, WAL listeners, SDK builders, boot-time configuration evaluators, CLI entrypoints, test files (as test_axis). Entry-point classes are the units for layer-4 feature synthesis. Mark each node-kind in your substrate with `entry_point: true | false`; the false set is pure-internal (services, repositories, mappers), the true set is your traversal-starting positions.

**Don't pre-design every axis or every entry-point class.** Pick the 3-5 highest-leverage of each to ship MVP; add axes / entry-point classes when a probe surfaces a class you missed.

**Step 4 — Author your canonical concepts page.** A single Markdown document (`docs/main-concepts.md` or equivalent) naming the domain vocabulary the project uses: entities, lifecycle states, key operations. The concept-merger anchors clustering on this page. Extensions surface as `canonical_candidate: true` entries to be triaged into the docs.

**Step 5 — Write per-language tree-sitter extractors.** One per language you scan. Java + TypeScript + YAML for ODD; replace with Python + HTML for Django, or Go + YAML for a Go service. Each extractor is independent; the substrate is the union. Files in `lineage/_extractor/src/lineage_extractor/extractors/`.

**Step 6 — Run the cycle.**

```
substrate scan                    → nodes.jsonl + edges.jsonl + rollups (10 minutes)
enrich --batch <entry-points>     → 5 sidecars (1 session) — rev 2: entry-point-anchored,
                                    each sidecar records upstream_callers + downstream_side_effects
                                    + per-behaviour test_class
reduce concept-merger             → concepts.yaml refresh
reduce adr-archaeologist          → implicit-adrs.md + refactoring-scopes.md refresh
reduce doc-gap-finder             → doc-gaps.md refresh (rev 2: feature-control-gap class)
reduce test-coverage-mapper       → test-map.yaml refresh (rev 2: per_feature 4-class matrix)
reduce feature-flow-builder       → feature-flows.yaml refresh                ← rev 2 NEW
probe Type-7 (user-observable)    → live-demo verification of feature invariants  ← rev 2 NEW
probe Type-4..Type-6 (adversarial / implicit-ADR confirmation) → existing
commit + open PR
```

Cadence: one batch per session is comfortable; the manifest carries `last_scan_commit` / `last_enriched_commit` / `last_entry_point_traversal_commit` so the next session resumes from disk state. Investigator-log (or equivalent) carries a one-paragraph batch summary so a new session can pick up cold.

**Batch-planning unit (rev 2)** — a batch picks 1-3 entry points (not 5 random code nodes) and traverses outward. Each entry-point chain produces a sidecar set with cross-references. Unresolved hops leave references that later passes resolve. Re-visiting the same code from a new entry-point context is the structural justification for the ontology — not a redundancy.

---

## 7. The probe protocol (universal)

A probe is a four-step exercise (see `lineage/PROBES.md` for the worked example):

1. **Name a user-visible capability.** Concrete, observable, one sentence.
2. **Locate it in code.** Which file/symbol primarily implements it? If you can't locate it, that's a navigation gap (separate finding).
3. **Run the substrate's enumeration query for that capability's expected axis.** E.g., "is i18n bootstrap present?" → query `WHERE axis = 'ui_shell' AND kind = 'ui-shell-bootstrap'`.
4. **PASS / FAIL.** PASS if the code-location appears in results with the expected kind and metadata. FAIL = `axis gap` (substrate lacks an axis for this capability — add one), `extractor bug` (axis exists but query missed the location — patch query), or `annotation gap` (node exists but lacks doc-link metadata — fix annotation).

**Acceptance is probe-driven, not coverage-%-driven.** A probe round (seed set + adversarial round of 3 from a maintainer who didn't write the seeds) must score ≥2-of-3 PASS. `coverage_pct` over the substrate's own enumeration is meaningful relative to known axes, never the acceptance criterion.

**The probe list extends with every miss.** When an incident produces an LSN retrospective, the rule-that-emerged includes a probe that would have caught it. `lineage/PROBES.md` is a continuously-runnable regression suite for the substrate's coverage.

**Probe classes** *(extended in rev 2)*:

| Class | Form | What it acceptance-tests |
|---|---|---|
| Type-1..Type-3 | Structural seed probes | Substrate's deterministic enumeration covers known axes correctly |
| Type-4 | Adversarial (3 unannounced probes from maintainer) | Substrate doesn't have hidden blind-spots on capability-negation / cross-product / synonym-swap shapes |
| Type-5 | Doc-linkage faithfulness | Bidirectional drift check: live doc page content vs sidecar understanding |
| Type-6 | Implicit-ADR confirmation | Maintainer writes 5 ADRs they know are followed; ≥3 must surface in `implicit-adrs.md` top-10 |
| **Type-7 *(rev 2)*** | **User-observable invariants — executable** | **Maintainer authors single-sentence user-facing promises ("opening detail page registers as 1 view"); each is run live against a demo/staging instance. Ontology must surface the invariant under a feature-flow node; live probe must confirm OR fail-and-be-cited as a known caveat. A FAIL where ontology was silent = methodology miss → log as LSN.** |
| **Type-8 *(rev 4)*** | **Analyser-emitted stress probes — file-analyser-authored, probe-runner-resolved** | **The file-analyser emits a probe-skeleton at `lineage/{repo}/probes/P-{NNN}.yaml` whenever the Stress Protocol (rule 13) produces a question that cannot be trace-answered from code alone. The skeleton is concrete (arrange/act/observe/assert filled in); `emitted_by: file-analyser`, `status: pending-stress-protocol`. The probe-runner subagent picks up `pending-stress-protocol` probes on its next sweep, executes against the local docker-compose mirror, and flips the originating sidecar's confidence from `PROBE-NEEDED` to `PROBE-VERIFIED` (or `PROBE-CONTRADICTED` if the measured value disagrees). Type-8 is the channel through which descriptive transcription becomes verified truth — the executable closure of Failure C. Case-law: LSN-019.** |

Type-7 probes are authored at the user-observable boundary by the maintainer; Type-8 probes are auto-emitted by the file-analyser whenever its Stress Protocol cannot derive an answer from the code. Together they form the *measurement layer* on top of the descriptive layers — the methodology shifts from *"the code says X"* to *"running the system at boundary case Y produces observable Z"*. Each batch should add 2-3 Type-7 probes (maintainer-driven) AND surface 5-20 Type-8 probes per analyser invocation (mechanically, from the Stress Protocol's coverage of the node).

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
- ***(rev 2)* No remote infrastructure for verification.** Every probe — Type-1 through Type-7 — runs on the maintainer's workstation. The dynamic-verification layer (when added) provisions an ephemeral local docker-compose stack (the same `trylocally`-shaped stack ODD's docs already ship). Probes execute against `localhost`; the writable mirror's volume gets destroyed between probe rounds. **No remote VMs, no managed databases, no cloud-CI runners as part of the probe loop, no hosted observability backends.** The constraint is operationally load-bearing: it keeps the methodology in the OSS-maintainer envelope (workstation + Claude Code subscription) instead of introducing a recurring-bill dependency that an unfunded OSS project cannot sustain. Open-source local tooling only — docker-compose / podman-compose for the runtime mirror, Testcontainers for ephemeral DB, Playwright / Puppeteer for headless-browser probes, k6 / wrk for load, WireMock / MockServer for external mocks. The maintainer's machine is the entire infrastructure.

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
| ***(rev 2)*** Two entry-point traversals converge on the same downstream node, surfacing a shared fact | Layer-4 composition is working. The same code visited from multiple entry-point chains accumulates meaning. |
| ***(rev 2)*** A feature-flow's `observed_vs_expected` flags a drift that no single sidecar contains | Cross-layer amplification / drift detection is working — the canonical view_count-doubling shape. |
| ***(rev 2)*** A Type-7 probe FAILS against a feature-flow that already flagged the drift | The methodology is producing actionable acceptance criteria for the live system. |
| ***(rev 2)*** A Type-7 probe FAILS where the ontology was silent | The methodology has a blind-spot — log as LSN, add to the rule set. (LSN-017-class incidents.) |
| ***(rev 2)*** A feature's 4-class test matrix shows non-empty cells in all four axes | The feature is structurally controlled — the empty-cells discipline is biting. |
| ***(rev 2)*** A documented feature appears in `feature-flows.yaml` with a matching `observed_vs_expected.expected` (drift = 0) | Code↔doc gap has narrowed to zero for this feature — the bridge is being built. |
| ***(rev 4)*** A sidecar's `stress_findings` block contains a `name_behavior_pair` with `drift: DRIFT_NAME_VS_BEHAVIOR` flagged AND an emitted Type-8 probe that the probe-runner subsequently resolves to `PROBE-VERIFIED` | The Stress Protocol caught and confirmed a real drift autonomously — the canonical `listMostPopular`-shape catch. Failure C is being closed *mechanically*. |
| ***(rev 4)*** The coverage dashboard's `stress_verified_pct` crosses 50% on a high-traffic node-set (controllers, repositories, schedulers) | The honest coverage axis is climbing. The methodology has moved from descriptive transcription to interrogated truth on the load-bearing surface. |
| ***(rev 4)*** A maintainer's empirical test of the running system matches what the ontology predicts for boundary, degenerate, and overflow cases | The interrogation discipline has reached the point where running the platform confirms the ontology, not contradicts it. This is the inverse of LSN-019. |

If a quarter goes by and none of these signals fire, the approach isn't taking hold — likely the sidecar quality is too shallow (Gate 9 not enforced), or the canonical concepts page hasn't been authored, or the project-specific axes don't actually cover the high-leverage code, or *(rev 2)* entry-point traversals aren't reaching the user-observable boundary (sidecars stop at services without recording downstream side-effects), or *(rev 4)* the Stress Protocol is being skipped (sidecars emitting with empty `stress_findings` on nodes that contain tunables / orderings / endpoints — the rev-4 failure mode resurfacing).

---

## 12. References — the long-form

This document is the methodology surface. The depth lives elsewhere in this workspace:

- `adrs/drafts/code-lineage-substrate.md` — substrate design (revision 3, research-backed). Anchors. Run modes. Tree-sitter stack choice rationale.
- `adrs/drafts/agentic-code-ontology.md` — enrichment + reducer design (revision 3, runtime-corrected). Sidecar schema. Subagent shapes. Why hybrid not pure-agent.
- **`adrs/drafts/feature-anchored-ontology.md`** *(rev 2)* — fourth-layer design. Entry-point principle. Feature-flow composition. 4-class test matrix. Type-7 probes. Schema v0.3.0 migration.
- **`adrs/drafts/dynamic-verification-layer.md`** *(rev 2 — draft)* — fifth-layer design. Local-only writable mirror via docker-compose. probe-runner subagent + /probe-run skill + probe and probe-run artefacts. The methodology principle "inferred truth is provisional; measured truth is canonical." 5-slice rollout starting with view_count F-001.
- `adrs/drafts/research/code-lineage-substrate/` and `adrs/drafts/research/agentic-code-ontology/` — research artefacts produced via the gsd-build/get-shit-done parallel-researcher pattern.
- `retrospectives/LSN-013` — research-punt case-law (why ADRs don't end with "open questions for human review").
- `retrospectives/LSN-016` — heuristic-vs-agentic case-law (why a tree-sitter substrate alone is not lineage; why Claude Code is the runtime, not the Anthropic API).
- **`retrospectives/LSN-017`** *(rev 2)* — per-node-vs-feature-anchored case-law (why per-node enrichment misses cross-layer user-observable composition; the view_count doubling probe).
- **`retrospectives/LSN-018`** *(rev 3)* — cross-batch reducer contradiction case-law (why parallel reducers emit contradictions; the coherence-sweep transverse to all reducers).
- **`retrospectives/LSN-019`** *(rev 4)* — file-analyser-describes-not-interrogates case-law (why descriptive enrichment without interrogation fails at boundaries; the `listMostPopular` drift; the Stress Protocol mechanism). The case-law that motivated rev 4 and section 14 of this document.
- `lineage/PROBES.md` — probe-driven validation as worked example (the i18n class, the security-default class, the housekeeping class). *(rev 2: extended with Type-7 user-observable invariant class.)*
- `CLAUDE.md` — workspace-operating bar (Principal Full-Stack standard, Quality Bar, autonomous-execution discipline). The `.claude/` directory is the executable form.
- `pillars/documentation/` — active pillar's cornerstones, gates, canonical-homes table, authoring rules. Template for activating new pillars.
- `playbooks/` — PROTOCOL-format universal rules (deep-research, pause-and-ask, consumer-read, live-site-verification, follow-up-on-disk, …). *(rev 2 will add: `entry-point-traversal.md`, `feature-flow-composition.md`.)*

If you're a Claude Code session invoked from another project pointed at this workspace: read this file end-to-end, then drop into the ADRs for the design rationale (start with `feature-anchored-ontology.md` if you're new to rev 2; otherwise the foundational pair first), then read one or two representative sidecars in `lineage/odd-platform/understanding/` to see the schema in practice. That's enough to bootstrap.

---

## 13. System mission anchor — Layer 0 (rev 3)

*(Added 2026-05-19 after batch I post-deployment review surfaced the bottom-up-only failure mode: 60 sidecars produced only 8 features, all bug-anchored caveats rather than user-observable pillars. The maintainer's diagnosis was sharp — the agent lacked the platform's gestalt. Rev 3 of `feature-anchored-ontology.md` introduces this universal layer beneath all others.)*

### Why this layer exists

Layers 1-5 of the methodology (substrate / per-node enrichment / cross-file reducers / feature-anchored synthesis / dynamic verification) all assume the agent already knows what "feature" means in the target project's domain. Without that anchor, code-walks produce drift findings at the granularity of the drift, not the granularity of the user. The canonical failure shape: a 60-sidecar code-walk produces 8 features, each anchored on a specific bug (a useEffect doubling, a path mismatch, a soft-delete leak, an ungated webhook). What's missing is the user-observable capability the bug LIVES INSIDE — "Popular Entities Ranking" is the feature; the doubling bug is one drift facet of it.

Layer 0 supplies the gestalt. A new subagent (`domain-extractor`) reads the project's canonical documentation source + the maintainer-curated concepts catalog + (when needed) maintainer-supplied framing, and emits `lineage/{repo}/system-mission.md` — a doc-anchored 8-12-pillar shape against which every downstream layer classifies its findings.

### The universal shape

`system-mission.md` is the same shape for every project the methodology ports to. The CONTENT is per-project (a Django catalog tool, a Go observability service, a Rust embedded controller — each gets its own 8-12 pillars), but the STRUCTURE is universal:

| Block | What it carries |
|---|---|
| **Mission statement** | 1-2 paragraphs anchored on the project's landing page narrative. Audience + problem + value delivered. |
| **Feature pillars (8-12)** | The primary user-observable capabilities at operator-facing granularity. Per pillar: one-line capability, primary user actions, data entities operated on, doc-side narrative excerpt (verbatim), doc URL + verification status, cross-pillar relationships, sub-feature seed list, audiences served, confidence. |
| **Audiences (6-10)** | Tagged audience identities + which pillars each primarily interacts with. |
| **Architectural pillars** | Orthogonal to feature pillars — the exposure shapes (UI, REST API, S2S, scheduled jobs, webhooks). Each names sidecar axes it correlates with. |
| **Canonicalisation candidates** | Pillars where doc coverage is thin OR code signal contradicts docs OR maintainer-curated vocabulary diverges. Surfaced for maintainer review. |
| **Cross-pillar relationships** | Compact graph view: which pillars feed which (the integration boundaries worth probing in Type-7 probe rounds). |
| **Sources** | Per-URL verification status with `fetched_at` timestamps. |
| **Confidence per pillar** | HIGH / MEDIUM / LOW with reason. MEDIUM is acceptable when local-source-of-truth markdown is read but live URLs aren't WebFetch-verified this session. |
| **Maintainer notes** | Preserved across `domain-extractor` refreshes. The only block the maintainer hand-edits. |

### Pillar discipline (universal)

A pillar qualifies as a pillar when:
1. The project's marketing / landing-page narrative names it as a primary capability.
2. The docs have a top-level section dedicated to it.
3. An operator can describe it in one sentence.
4. Multiple sub-features compose under it.

What is NOT a pillar:
- Architecture concerns (UI, REST API, scheduled jobs) — those go under `architectural_pillars`.
- A single mutation / bug surface (the rev-2 failure mode).
- A substrate axis (controllers, repositories, config-properties) — those are implementation slicing.

**Pillar count must land in [8, 12].** Below 6, too coarse (sub-features missed). Above 12, too fine (over-sliced). `domain-extractor` STOPS and surfaces to maintainer if the count falls outside that band.

### Doc-source contract

Live URLs are the gold standard for content verification (rendering matches what operators see; GitBook macros applied; SUMMARY ordering honoured; redirects resolved). When WebFetch is denied, **local source-of-truth markdown** (the project's documentation source repo) is an acceptable substitute with explicit `confidence: MEDIUM (local-anchored; live verification pending)`. Pretraining is **never** acceptable — same discipline as Rule 1 of `file-analyser.md`.

The contract:
- WebFetch denied AND no local doc source available → STOP; explicit error.
- Local docs read instead of live → confidence drops to MEDIUM; `live_url_verifications` frontmatter records `status: pending-WebFetch-session` per URL; live verification is logged as a known follow-up.
- Live URLs read AND verified → confidence HIGH.

### Run cadence

`domain-extractor` runs **once per substrate scan**, not per batch. It refreshes when:
- The substrate is re-scanned (project structure has shifted enough that the substrate IDs change).
- The project's documentation IA changes substantively (a new pillar lands; an existing one is renamed; the SUMMARY restructures).
- The maintainer hand-edits the `## Maintainer notes` block to override agent classifications.

Re-runs are CHEAP at the run level (no batch coordination needed); the artefact is small (~30-50 KB), single-pass written, and the downstream reducers consult it on every batch.

### Downstream consumption

Every downstream reducer's prompt gains a "consult `system-mission.md` for classification" rule. The largest changes are in `feature-flow-builder`:

- Reads `system-mission.md` BEFORE producing/updating any feature.
- For each emerging code chain:
  - **Map to a pillar** — classify into one of the pillars; if none fits, surface as `canonical_candidate: true` for maintainer review (never invent a new pillar autonomously).
  - **Mint feature_id within the pillar's namespace** — two-tier IDs: `P-NN:F-NNN` (e.g. `P-01:F-001` for "Data Discovery → Popular Entities Ranking").
  - **Bug-shaped findings become `drift_class` facets** inside pillar-anchored features, NOT standalone features.
  - **Cross-pillar interactions** surface as relationship-edges on `system-mission.md`, NOT separate features.

Other reducers (concept-merger, doc-gap-finder, test-coverage-mapper, adr-archaeologist) get lighter touches — they consult Layer 0 to anchor naming, severity weighting, and integration-test gap classification (cross-pillar = integration; within-pillar = unit).

### Bootstrapping a new project

When porting this methodology to a new project (Django, Go, Node, anything), Layer 0 is the FIRST agent invocation after the substrate scan:

```
1. Run substrate scan         → nodes.jsonl + edges.jsonl
2. Run domain-extractor       → lineage/{repo}/system-mission.md   ← Layer 0
3. Maintainer reviews mission → curates pillar names + cross-refs in ## Maintainer notes
4. Run enrichment batches     → sidecars (Layers 2-5)
```

Without step 2 + 3, the methodology produces bug-pin features — the rev-2 failure shape. With them, features emerge at the operator-facing granularity from the first batch.

### Cross-references

- `adrs/drafts/feature-anchored-ontology.md` rev 3 — the ADR introducing this layer.
- `.claude/agents/domain-extractor.md` — the Layer 0 subagent's system prompt + output schema.
- `lineage/{repo}/system-mission.md` — the canonical output (one per project).
- `.claude/agents/feature-flow-builder.md` rev 3 — the primary downstream consumer; classifies code chains against the pillar shape.

---

## 14. Stress Protocol — Layer 2 interrogation (rev 4)

*(Added 2026-05-20 after the maintainer's empirical test of the running platform exposed a drift between `tagService.listMostPopular`'s name and its actual SQL behavior. The ontology had transcribed the method as "returns most-popular tags" — because the name says so and the JOOQ chain has a count CTE — while the OUTER select had no `ORDER BY count` clause, so the SQL returns rows in natural order and the operator sees the OLDEST 30 tags labelled "Top Tags". The wrong claim shipped with `confidence: HIGH` for weeks because Layer 2 was descriptive, not interrogative. Rev 4 of the methodology bolts the Stress Protocol into Layer 2 as a non-negotiable pre-emit phase. Case-law: `retrospectives/LSN-019`.)*

### Why this discipline exists

Layers 1-5 of the methodology assume the LLM running Layer 2 will surface anything operator-relevant. **An unprompted LLM defaults to transcription**: it describes what the code says, accurately at the surface and silently wrong at the boundaries. A senior engineer reading `size: 30` does not stop at *"shows 30"*; they ask *what at N=0? at N=31? at N=10000? what determines which 30? what's the tie-break? what does the operator see when the underlying set exceeds the limit?* — and answer each by tracing the code or running it. A senior engineer reading `listMostPopular` does not stop at *"returns popular tags"*; they ask *the name promises popularity; does the SQL deliver it? trace the chain. look for ORDER BY count. if absent — what does the natural row order produce?*. The Stress Protocol bakes these questions into the file-analyser system prompt mechanically — every triggered question fires; every triggered question is answered.

This is the agent-tooling analogue of the heuristic-substrate-vs-agentic-enrichment pivot (LSN-016): Layer 1 was structurally complete and semantically empty until Layer 2 added meaning; Layer 2 was semantically populated and interrogatively empty until rev 4 added the Stress Protocol. The fix shape is the same in both cases — make question-generation explicit and mechanical, do not depend on the LLM/walker to ask the right thing on its own.

### The universal shape — five trigger categories

The categories are universal across projects (they map to load-bearing operator-observable shapes in any code). Each category carries a fixed question list; the LLM does not invent the questions, it answers them.

| Category | Triggers (enumerate in every node) | Mandatory questions |
|---|---|---|
| **A — Tunables** | Numeric literals > 1 in limits / sizes / counts / timeouts / retries / intervals / page sizes; `@Value("${...:default}")` annotations; `private static final` constants; default property values; magic strings that gate behavior | Q1: What at N=0 / N=1? Q2: What at N=tunable / tunable+1 / tunable×100? Q3: What at null / negative / non-numeric? Q4: What does the operator see at each boundary — silent truncation, error, wrong-but-plausible result? |
| **B — Name-behavior pairs** | Method names with promising verbs (`listMostPopular`, `findActive`, `deleteExpired`, `topN`, `getRecent`); endpoint annotations (`@GetMapping("/popular")`); javadocs / comments making behavioral claims | Q1: What does the name *promise*? Q2: What does the implementation *actually do* (SQL end-to-end, body logic, paginate-wrappers, decorators)? Q3: Does the implementation match the promise? If NO → `drift: DRIFT_NAME_VS_BEHAVIOR` + operator-visible consequence |
| **C — Orderings / pagination / aggregation** | Every `ORDER BY` in SQL / JOOQ chain; every `LIMIT` / `OFFSET` / `paginate(...)` / `Page<...>` return; every `.sort(...)` / `Comparator`; every GROUP BY / aggregation function | Q1: What is the actual ORDER BY at the lowest layer (the SQL the database executes)? Q2: What is the tie-breaker when sort-key values are equal — deterministic or undefined? Q3: When result-set > page size, which subset is returned? Q4: Does any layer above re-sort or filter? Does that hide a backend ordering issue? |
| **D — Authorization gates** | Every controller endpoint; every `@PreAuthorize`; every programmatic `permissionService.hasPermission(...)` | Q1: What does this endpoint return for each auth mode (project-specific — for ODD: DISABLED / LOGIN_FORM / OAUTH2 / LDAP; for Django: ALLOW_ANY / SessionAuth / TokenAuth / PermissionRequired; etc.)? Q2: What does an unauthenticated caller see? Q3: What does a wrong-role caller see? Q4: Where does the gate live — controller / service / repository / nowhere? |
| **E — Resource boundaries** | `@Transactional`, `synchronized`, explicit lock acquisition; caches (`@Cacheable`, manual); "insert or update" / `ON CONFLICT DO UPDATE`; `@Async` / `Flux`/`Mono`; scheduled jobs touching shared state | Q1: Can two simultaneous calls produce corrupted state — lock violation, duplicate row, lost update? Q2: Is the call replay-safe — same payload + same caller → idempotent? Q3: If a cache fronts this, what is the TTL / eviction key / staleness window? |

**Category triggers are language-agnostic in concept; language-specific in detection.** A Java project triggers Category D on `@PreAuthorize`; a Django project triggers it on `permission_classes`; a Rust Axum service triggers it on `axum::middleware::from_fn`. The category exists in every project; the detection rules adapt to the stack.

**Add a category when a maintainer's empirical test exposes a class the existing five don't cover.** Categories are open-ended; rev 4 ships with five because those covered the LSN-019 incident and the surrounding ODD case-law (auth-mode posture from REFACTOR-185, ordering drift from listMostPopular, tunable boundaries from page sizes, name-promise drift from miscellaneous controller methods, resource boundaries from the housekeeping jobs). The next maintainer test will likely expose Category F.

### How an answer is recorded

Every triggered question takes EXACTLY ONE of three answer forms. They are not interchangeable:

| Form | When | Recorded as | What downstream consumer does |
|---|---|---|---|
| **(a) Trace-answer** | The answer is in the code (this file + 1-hop neighbours) | `confidence: STATIC-INFERRED` + `evidence: <file:line>` + the trace conclusion as the answer text | This is the file-analyser's normal output. Reducers consume it directly. |
| **(b) Probe-answer** | The answer requires running the system (boundary behavior, race condition, cache staleness, auth-mode interaction) | The file-analyser **writes a concrete probe-skeleton** at `lineage/{repo}/probes/P-{NNN}.yaml` (next free ID; `emitted_by: file-analyser`, `status: pending-stress-protocol`, with `arrange`/`act`/`observe`/`assert` filled in concretely — same structure as maintainer-curated probes). The sidecar records `confidence: PROBE-NEEDED` + the `probe_id` | The `probe-runner` subagent picks up `pending-stress-protocol` probes on its next sweep, executes against the local docker-compose mirror, and flips the originating sidecar's confidence to `PROBE-VERIFIED` (or `PROBE-CONTRADICTED` if the measured value disagrees with the analyser's trace hypothesis). |
| **(c) Reference-answer** | The answer lives in another node's sidecar (e.g. a UI-side question encountered while enriching a backend controller) | `confidence: REFERENCE` + `evidence: <node_id of the answering sidecar>` | The feature-flow-builder composes answers across referenced nodes on its next pass. The reference resolves automatically when the target sidecar exists. |

**No triggered question may be skipped.** A sidecar emitting `stress_findings.stress_summary.triggers_total == 0` on a node containing numeric literals, method-name verbs, endpoint annotations, ORDER BYs, or `@PreAuthorize` annotations is REJECTED. Empty categories on a node that genuinely has no triggers in that category (e.g. a pure mapper class) are recorded as explicit `[]` — distinguishing "I checked; no triggers" from "I forgot to check".

### Honest confidence after the Stress Protocol

The sidecar's `confidence_overall` is **downgraded to MEDIUM** when more than half of load-bearing stress questions resolve to `PROBE-NEEDED`. **HIGH confidence overall requires** that the load-bearing operator-observable claims are either `STATIC-INFERRED` with strong evidence OR `PROBE-VERIFIED`. The vanity case — sidecar has many `bugs_limitations_corner_cases` items but no `stress_findings` — is mechanically detectable: `stress_summary.triggers_total > 0 AND stress_summary.answers_static_inferred + answers_probe_verified < stress_summary.questions_total / 2` → confidence is structurally LOW or MEDIUM, never HIGH.

### Coverage metric — the honest axis

The coverage reducer (`lineage/_extractor/registry-shard/coverage.py` in the reference implementation) produces TWO axes side-by-side:

| Axis | Formula | What it counts |
|---|---|---|
| **Static enrichment coverage** *(vanity, kept for trend continuity)* | `nodes_with_sidecar / total_substrate_nodes` | Nodes TOUCHED. Climbs as the file-analyser is invoked on more nodes. Does NOT distinguish a thorough interrogation from a shallow transcription. |
| **Stress Protocol coverage** *(the honest axis, rev 4)* | `(STATIC-INFERRED + PROBE-VERIFIED) / total stress questions across all sidecars` | Claims VERIFIED. Climbs as the Stress Protocol interrogates more triggers AND as the probe-runner resolves probe-skeletons into measured truths. PROBE-NEEDED and REFERENCE count as unfinished work, not as coverage. |

The maintainer's reading of "X% coverage" must mean *"X% of load-bearing operator-observable claims are interrogated against the code or measured against the running system"*, not *"X% of nodes have some sidecar"*. The dashboard renders both, with explicit framing distinguishing them. The substantive question — *"can the operator trust this ontology?"* — is answered by the stress-protocol axis, not the node-touched axis.

### Run cadence

The Stress Protocol fires on **every file-analyser invocation** — there is no opt-out. The protocol runs between the structural enrichment phase (workflow step 6 in `file-analyser.md`) and the self-check phase (step 7); the analyser does NOT write the sidecar until the Stress Protocol has completed. Probe-skeleton files are written as part of the same invocation. One sidecar per invocation is mandatory; zero-to-many probe-skeleton files per invocation are normal.

For existing sidecars authored before file-analyser/0.4.0 (pre-rev-4): a batch theme of "Stress Protocol backfill" re-enriches them under the new prompt. The coverage dashboard's `sidecars_pre_stress_protocol` count makes the backfill gap visible until closed.

### Bootstrapping a new project

When porting this methodology to a new project (Django, Go, Node, anything), the Stress Protocol is wired in from day one:

```
1. Run substrate scan         → nodes.jsonl + edges.jsonl
2. Run domain-extractor       → system-mission.md       ← Layer 0 (rev 3)
3. Maintainer reviews mission → curates pillar names
4. Run enrichment batches     → sidecars + analyser-emitted probes  ← Layer 2 with Stress Protocol (rev 4)
5. Run probe-runner on pending-stress-protocol probes → resolves PROBE-NEEDED → PROBE-VERIFIED
6. Run reducers + feature-flow-builder + coherence-sweep  ← Layers 3-4
```

The five categories in section 14's table are universal; their detection rules are stack-specific (one paragraph per category in the new project's `file-analyser.md` instance, naming the language-specific triggers — `@PreAuthorize` for Spring, `permission_classes` for DRF, `axum::middleware::from_fn` for Axum, etc.).

### Cross-references

- `retrospectives/LSN-019` — the case-law that motivated rev 4.
- `.claude/agents/file-analyser.md` rev `file-analyser/0.4.0` — the Stress Protocol baked into the system prompt; the universal source of truth for category triggers + question lists + answer forms.
- `.claude/agents/probe-runner.md` — the downstream consumer that resolves `pending-stress-protocol` probes into measured truths.
- `lineage/_extractor/registry-shard/coverage.py` — the reducer that renders the honest stress-verified axis alongside the static-coverage axis.
- `adrs/drafts/feature-anchored-ontology.md` rev 4 (pending) — the ADR update incorporating rule 13 and section 14 into the formal methodology design.
