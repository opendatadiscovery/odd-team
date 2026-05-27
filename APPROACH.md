# Approach — agentic code ontology for living codebases

A portable methodology for building a queryable, self-maintaining ontology of any non-trivial codebase, run by AI maintainers inside Claude Code. Originally built for Open Data Discovery (Java + Spring + React + TypeScript); applicable to any project with source code, documentation, and tests.

**Audience.** Two readers: (a) the human engineer of a new project who wants to bring this approach over without reinventing it; (b) Claude Code itself, invoked from that new project, pointed at this workspace, asked to bootstrap the same approach for a different stack.

**Scope of portability.** The METHODOLOGY ports: four-layer architecture, sidecar schema, reducer subagent shapes, entry-point principle, feature-flow composition, 4-class test matrix, case-law format, probe protocol, Quality Bar rules. The CONCRETE INSTANCES do not: per-language tree-sitter extractors, project-specific node kinds (controllers vs CLI commands vs GraphQL resolvers), entry-point classes (Django views vs Express handlers vs Lambda functions), the case-law file contents (LSN incidents are project-specific), the canonical concept page. Copy the framework; author the instances.

**Revision history.** Rev 1 (2026-05-12): initial portability surface with three-layer architecture (substrate / per-node enrichment / reducers). Rev 2 (2026-05-19): fourth layer added — feature-anchored synthesis with entry-point traversal, feature-flow composition, and 4-class test matrix. Trigger: LSN-017 (per-node scan cannot see cross-layer user effects). Rev 3 (2026-05-19): Layer 0 added — `system-mission.md` mission anchor produced once per substrate scan by the `domain-extractor` subagent; supplies the user-observable pillar gestalt that the rev-2 failure mode lacked. Trigger: post-batch-I review (60 sidecars → only 8 features, all bug-anchored). Rev 4 (2026-05-20): **Stress Protocol** bolted into Layer 2 — every file-analyser invocation now interrogates the code (boundary cases, name-behavior drift, ordering semantics, auth-mode posture, resource boundaries) instead of describing it; analyser-emitted probe-skeletons become first-class artefacts; the coverage metric splits into "static enrichment coverage" (vanity, kept for trend continuity) vs "stress_verified_pct" (the honest axis). Trigger: LSN-019 (the `listMostPopular` drift — method named "popular" returns the OLDEST 30 by creation order because the SQL has no `ORDER BY count` clause; the methodology had transcribed the surface meaning as truth for weeks). Rev 5 (2026-05-21): **Two complementary additions to close the cross-file intent-vs-implementation gap** — (a) Category F bolted into the Stress Protocol (request-input naming alignment — every named query parameter / request DTO field / path variable / header is interrogated for whether the implementation's actual scope matches the name's promise; the inverse-direction check looks for available-but-unused columns and parameter-name-vs-SQL-column drift across the chain); (b) Layer 4b added — `feature-reflector` subagent — a top-down product-owner reflection pass over each composed feature flow, producing a stepped-back narrative, 5-15 falsifiable user-facing hypotheses, and per-hypothesis verdicts (confirmed / contradicted / partial / probe-needed) traced through the implementation chain. Contradictions are the highest-priority bug/caveat findings — cross-file semantic mismatches that no single sidecar can see in isolation. Trigger: LSN-020 (the Activity Feed `userIds` filter — query parameter named `userIds` binds to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` at the SQL layer; users without an owner mapping cannot be filtered, owner-user association changes retroactively rewrite past attribution, the actual actor column `activity.created_by` is JOINED but never FILTERED; the methodology's per-file Stress Protocol had Category B for METHOD-name drift but no equivalent for PARAMETER-name drift, AND no top-down reflection pass to ask *"what does this feature promise users, and does the assembled chain deliver it?"*). Rev 6 (2026-05-21): **The Adversarial Review Panel** — a meta-review subsystem (section 16) that periodically and independently audits the methodology *itself*. Six expert subagents on six orthogonal axes (Coverage / Process / Cost / Depth / Usefulness / Honesty) + a chair run a three-phase pass — independent assessment → one cross-examination round → chair synthesis — generating fresh blind spot-checks against the real codebase and emitting a `GO` / `GO-WITH-CHANGES` / `STRUCTURAL-RETHINK` verdict. The methodology's *reactive* self-correction loop (case-law / LSN) gains its missing *proactive* loop. Trigger: LSN-021 (the methodology has no independent oracle — it is graded by the minds who built it and improves only by accreting layers; the maintainer's external hand-picked spot-checks keep surfacing gaps the methodology's own probes did not — Failure E). Rev 6 also establishes the **explicit target** (§16.2): the panel measures the methodology against a written, versioned, improvable `target.md` and every reviewer reflects it through its own axis — an implicit "target" is a fluent (LSN-022). Anchor ADRs: `adrs/drafts/feature-anchored-ontology.md` (rev 2-3) + rev-4 / rev-5 update pending; `adrs/drafts/adversarial-review-panel.md` (rev 6). Rev 7 (2026-05-21): the derived graph query layer + the agentic retriever (section 17) — an ephemeral, local, query-time graph + vector index that decouples per-query context cost from total ontology size. Rev 8 (2026-05-22): **the operating stance made explicit (section 0).** Sections 1-17 are machinery accreted reactively — one layer per incident; rev 8 states, ahead of the mechanics, the operating bar all of it was always meant to be run under: this is reverse engineering of a user-facing product; every layer is run as Linus Torvalds (the engineering bar) AND a senior product owner (the feature bar); the user-facing surface — the UI interaction layer (screens, forms, modals, combo-boxes), not merely route mounts and the app shell — is the primary object of analysis, a mandatory substrate axis, never triaged away. Rules 17-19 are the enforceable hooks; section 6 Step 3 makes the UI axis mandatory. Trigger: LSN-023 — the ontology extracted 31 "features" for a heavily UI-driven platform with the UI interaction layer absent (0 of 159 sidecars covered a form or a modal); F-031 emitted a confidently-wrong "permission side-door" finding from a backend-only chain; and the miss was first explained away as "structural frame-blindness" — the junior engineer's excuse in better vocabulary. Rev 9 (2026-05-22): **the meta-review subsystem simplified (section 16).** The six-expert Adversarial Review Panel is replaced by a single `methodology-reviewer` agent that traces the whole current methodology — APPROACH.md (every section + revision), the ADRs, the agent contracts, the skills, the case-law, the live artefacts — diffs against the prior review, runs fresh blind spot-checks, and emits real gaps + improvement proposals (including subtraction), at roughly one-seventh the cost. Trigger: LSN-024 — the panel was six correlated Claude experts scoring conformance against a fixed target with no memory; it re-listed stale findings every run and missed rev-7 entirely, re-recommending an index-shard the graph query layer had already superseded. Rev 13 (2026-05-27): **scanner ↔ ontology fusion (section 20 + Rule 21).** The methodology had grown two pipelines side-by-side with no formal interface — the **breadth-first scanner pipeline** (`scanners/` → `findings/` → `/triage` → `backlog/`, doc-as-requirements-registry) and the **depth-first ontology pipeline** (substrate → sidecars → reducers → `feature-flows/` + `shoebox/`, code-as-truth). Rev 13 gives every scanner two run modes: (a) **standalone** (unchanged, backward-compatible); (b) **ontology-fed** — iterates `lineage/{repo}/feature-flows/detail/F-*.yaml` as the PRIMARY investigation target (per-feature pseudo-protocol: read F-NNN end-to-end → verify via clue-class ladder → fetch expected doc → emit findings → write-back annotation). `doc-gaps.md` is a dedup/priority hint only — a feature absent from doc-gaps is NOT presumed documented (the maintainer-applied refinement: PITFALLS rule D13). The scanner gains an **annotate-only write-back** contract: `scanner_reviews:` append-only list on feature-flows + sidecars + doc-gaps; reducers remain the sole writers of feature semantics. PO + SME consultations route through the rev-11 SME pattern with hard per-run budgets (3 / 2 / 5 for feature-reflector / odd-sme / graph-retriever). A new SoT class `Ontology` is additive, always co-cited with the underlying primary-source class. Pilot scanners: `docs/coverage/undocumented-features` + `docs/accuracy/feature-behavior` on Day 1; ~18 of 28 broaden at Day 30; `doc-gap-finder` restructure deferred to Day 90 pending pilot data. Trigger: maintainer-identified gap (2026-05-27) — the two pipelines have been complementary but parallel since rev 1; 726 ontology-surfaced candidate findings (103 doc-gaps + 211 refactoring-scopes + 312 test-gaps) were unreachable by `/triage`; the maintainer was the only deduplication channel. Anchor: `adrs/drafts/research/scanner-ontology-fusion/SUMMARY.md` (research-backed; 6 artefacts; maintainer-signed-off with the doc-gaps-not-exhaustive refinement). Rev 12 (2026-05-26): **Failure F + Rule 20 — substrate-axis surface coverage is a first-class probe.** Rev 8 (LSN-023) made the UI interaction layer a *mandatory* axis but did not make any axis *surface-covered*. The substrate's `ui_routes` (12 nodes) + `ui_shell` (13 nodes) were treated as "the UI axis" while the platform shipped ~550 React components — 530 of them invisible to file-analyser, shoebox-fulfiller, feature-flow-builder, and graph-retriever alike. The fix is structural: every declared axis carries a written **conceptual ceiling** (a back-of-envelope upper bound on the node count the extractor should produce), gets a **Type-3.5 substrate-coverage probe** at registration time, and is treated as **MISSING** for downstream purposes when its enumeration drops below 30% of the ceiling (default; per-axis overrideable). The class generalises beyond UI — `controllers` may cover `@RestController` but miss WebSocket / SSE / message-listener / scheduled-job handlers; `config_prefixes` may cover `@ConfigurationProperties` but miss scattered `@Value` reads / env-var consumers / SpEL expressions; `tests` may cover JUnit files but miss fuzz harnesses, Pact contracts, k6 scripts. The axis name promises a surface; the extractor enumerates a syntactic subset; the gap is invisible until the ratio is named. Trigger: LSN-025 — the maintainer asked why two specific operator-facing surfaces (the Owner-Association admin triplet under `/management/associations/*` and the per-entity Overview tab + class badges) were still unanchored after 122 SHB threads + 36 graduations; root cause was 530 React components had no substrate node at all, and downstream phases inherited the substrate's blind spot.

---

## 0. The operating stance — non-negotiable

*(Added rev 8, 2026-05-22. This stance was always the bar; it is written here because it was violated — the ontology extracted "features" for a heavily UI-driven product with the UI interaction layer absent — and a methodology that leaves its operating bar implicit lets shallow work pass. This section precedes the mechanics on purpose: no layer, protocol, or agent in sections 1-17 produces a correct result if run below this bar. Case-law: `retrospectives/LSN-023`.)*

### 0.1 This is reverse engineering

You are not handed requirements. There is no spec to implement. The maintainer cannot afford to write feature specs for an agent — and does not. The task is to **reverse-engineer the truth that is already in the codebase** and record it as the ontology — feature descriptions, documentation, tests, ADRs.

Three consequences, non-negotiable:

- **All behaviour is derivable from the code — nothing happens by magic.** "I don't know how X works" / "I wasn't sure" is never an acceptable stopping point: read the code — this file and every file it reaches — until you actually know. An un-traced claim is not knowledge.
- **Doubt is resolved by running the system, not by guessing.** When reading leaves genuine doubt, stand up a local instance of the component (section 9 rule 12 — local-only) and observe the real behaviour. A hedge ("probably", "likely") where you could have run it is a defect.
- **Iterate bottom-up AND top-down, as many passes as needed — there is no iteration budget.** Bottom-up: a piece of code → its ontology + lineage → the feature (or part of a feature) it serves → hypotheses about the feature, the user interactions, the caveats, the corner cases. Top-down: take the assembled feature and review it as a senior practitioner of this class of system — *how should a system of this type work; what value should it bring, and how?* Bottom-up without the top-down review produces backend mechanics with no user; top-down without the bottom-up produces unanchored speculation. Both are mandatory, every cycle.

### 0.2 You operate as two named people — and a junior is not one of them

Every layer, every agent, every batch is run under two standing identities. They are not lenses applied when convenient; they are who you are while doing this work.

**Linus Torvalds — the engineering bar.** Reviewing a user-facing platform, Linus never gets past the obvious questions and never waits to be told to ask them: *How does the user interact with the system? What does the user literally have in their hands? How does it look from a UX standpoint, on different device types? Is it consistent across the platform's features?* He refuses to call an analysis "done" while those are unanswered. He diagnoses the class, never patches the instance. He does not transcribe code; he interrogates it.

**A senior product owner — the feature bar.** A senior product owner never stops at "there is a UI shell" or "there is an endpoint." For every feature they ask, unprompted: *How will the user understand how to use this? Is it convenient? Is the UI intuitive, and consistent with the rest of the platform? Can it be customised?* They reason about a feature from the screen and the flow the user lives through — not from the endpoint shape and the DTO field names.

**The junior is the failure mode.** The junior answers a missed check with *"I never reviewed that — you never asked me to."* That answer is **forbidden**. The bar does not depend on a specific instruction naming a specific check; not being told to do an obvious thing is never a defence. Laziness, ignorance, and shallowness are defects in the work — never a smaller scope, never an acceptable state to ship from. Explaining a miss away with sophisticated framing — "structural", "frame-blindness", "nothing had the mandate" — is the junior's excuse wearing better vocabulary, and is itself a violation of this stance.

### 0.3 The user-facing surface is the primary object of analysis

This methodology builds an ontology of a product that **humans use**. The controllers, services, repositories, and config are not the product — they are the machinery behind it. The product is what the user sees, holds, and does: the screens, the forms, the modals, the tables, the combo-boxes, the buttons, the flows, and how they behave across devices.

Therefore the user-facing surface — the UI and its interaction layer — **is not one axis among several; it is the surface the entire ontology exists to explain.** A feature analysis that stops at the backend endpoint chain, or at a bare UI route, has not analysed the feature: it analysed the machinery and skipped the product. Sections 4 and 6 make this enforceable (the UI interaction layer is a mandatory substrate axis for any user-facing product); rules 17-19 are the gate; a feature flow whose UI surface is unresolved is incomplete, not done.

### 0.4 Why the machinery of sections 1-17 is not enough on its own

Sections 1-17 are machinery — layers, protocols, a panel — each added reactively to catch the previous incident (Failure A → a layer, B → a layer, C → the Stress Protocol, D → the feature-reflector, E → the panel). The machinery is sound. But machinery run below this bar produces exactly what LSN-023 records: a seven-revision methodology — including a layer literally named "top-down product-owner reflection" — that extracted features for a UI product without looking at the UI. The fix for that is not an eighth layer. It is this section: the bar stated once, explicitly, ahead of the mechanics, plus the rules and agent-contract clauses that wire it in. Hold section 0 and the layers do their job; run the layers without it and no amount of machinery saves the result.

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

And one reflexive commitment beyond those eight: the methodology continuously audits **itself**. Its own process, progress, and cost are periodically reviewed by an independent expert panel from outside its frame (section 16) — because a methodology graded only by the minds who built it cannot see its own blind spots, and improvement-by-accretion is not the same as convergence on a target.

---

## 2. Why this approach exists (the failure modes it solves)

Five failure modes the approach exists to defeat. All have case-law in `retrospectives/`.

**Failure A — tribal-knowledge decay** (pre-LLM operating mode). Architecture, conventions, corner-cases live in maintainers' heads. Doc drifts; new joiners reinvent. ADRs get written retroactively if at all. Most projects ship knowledge-loss as a feature.

**Failure B — heuristic-only enumeration** (early pre-LLM tooling, the trap LSN-016 calls out). A tree-sitter / regex / annotation walker produces syntactically-correct nodes ("here is every `@RestController`") but zero semantic content ("what is this controller FOR? where does the doc disagree? what bugs lurk?"). It misses code that does the same thing with a different annotation. It produces no `implicit_adrs`, no `caveats`, no divergence findings. **A heuristic substrate that calls itself lineage is the antipattern.**

**Failure C — descriptive enrichment without interrogation** *(rev 4, LSN-019)*. The methodology adds Layer 2 (per-node enrichment) on top of the substrate and assumes the LLM will surface anything worth surfacing. **But an LLM reading code defaults to transcription**: it sees `size: 30` and writes *"shows top 30"*; it sees `listMostPopular` and writes *"orders by popularity"*; it sees `@PreAuthorize("hasRole('ADMIN')")` and writes *"admin-only"*. The surface description is correct AT THE CENTER and wrong AT THE BOUNDARIES — which is exactly where operators get hurt. The canonical incident: `tagService.listMostPopular` was transcribed as *"returns most-popular tags"* because the method name and the count-CTE in the SQL suggest popularity ordering; the actual JOOQ chain has no `ORDER BY count` clause, so the SQL returns rows in natural (creation) order; the operator sees the OLDEST 30 tags labelled *"Top Tags"*. The wrong claim shipped with `confidence: HIGH` for weeks because the methodology never generated the question *"the SQL has a count column — does the OUTER select actually `ORDER BY count DESC`?"*. A senior engineer reading the same code generates that question instantly. **Failure C is the agent-tooling analogue of Failure B** — one layer up: where Failure B is structurally complete + semantically empty (heuristic walker emits node, no meaning), Failure C is semantically populated + interrogatively empty (LLM emits sidecar, no boundary thinking). The fix shape is the same in both cases: bake question-generation into the layer itself, mechanically, on every invocation. Failure C's fix is the **Stress Protocol** (section 5, rule 13 + section 14).

**Failure D — bottom-up assembly without product-owner reflection** *(rev 5, LSN-020)*. Even with the Stress Protocol catching per-file drift (Failure C's fix), the methodology still misses bugs that span across files because their signal is the assembled feature's gap between what it PROMISES the user and what it DELIVERS. Each layer in isolation is locally consistent; only the assembled chain reveals the drift. The canonical incident: Activity Feed's `userIds` query parameter binds to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` at the SQL layer (`ReactiveActivityRepositoryImpl.java:272-273`) — the controller takes a parameter named `userIds`, the service forwards `userIds`, the repository binds `userIds` to `OWNER_ID`. Each sidecar's claim is locally accurate; the Stress Protocol's Category B catches method-name drift but no category catches parameter-name drift across files; and no layer steps back to ask *"the feature is named 'Activity Feed' and the parameter is named 'userIds' — does filtering by userIds=[42] actually return events the USER with id 42 generated, or events on entities the OWNER with id 42 owns?"*. The bug shipped with the sidecar flagging "user-id enumeration" as the concern while completely missing that the filter does not do what the parameter name promises. **Failure D is the cross-file analogue of Failure C** — one layer up again: where Failure C is per-file transcription without per-file interrogation, Failure D is per-file interrogation without cross-file product-owner reflection. The fix is twofold: (a) **Category F** added to the Stress Protocol — every named request input fires the question "the name promises X, does the implementation operate on X?"; (b) **Layer 4b** added — the `feature-reflector` subagent runs a top-down pass on each composed feature flow, generates falsifiable user-facing hypotheses derived from endpoint shape / DTO names / UI labels / pillar mission, and validates each hypothesis by tracing the implementation chain. Contradictions are the highest-priority bug/caveat findings. See section 15.

**Failure E — the methodology cannot audit itself** *(rev 6, LSN-021)*. Failures A-D are gaps *inside* the ontology-building pipeline, and the fix each time was to add a layer or a protocol. But the act of adding layers is itself a process, and that process has no independent check. The methodology is graded by the same minds that authored it: the probe protocol (Type 4/6/7) lives inside this document and is largely maintainer-seeded; `coherence_sweep.py` checks only internal consistency; `/review` and `/probe` are per-change. The one genuinely independent oracle in the loop is the maintainer's hand-picked spot-check — and after many ontology iterations it keeps surfacing gaps the methodology's own probes did not. That is the signal: a methodology that adds a layer for every miss, forever, graded only from inside its own frame, accumulates undetected blind spots and unexamined cost, and cannot tell whether it is converging on its target or merely thrashing. **Failure E is the meta-failure** — where A-D are blind spots *in* the pipeline, E is the blind spot of having no one watch the pipeline. Its fix is not another pipeline layer: it is the **methodology meta-review** (section 16), a periodic independent review of the methodology's process, progress, and cost, run from outside its frame — the methodology's *proactive* self-correction loop, sibling to the *reactive* case-law loop of section 8.

**Failure F — substrate axis declared but enumerates only the entry-points / shell of its conceptual surface** *(rev 12, LSN-025)*. The substrate (Layer 1) is the join key for every downstream phase — file-analyser, shoebox-fulfiller, feature-flow-builder, graph-retriever — and each phase trusts the substrate to enumerate the nodes that exist. When the substrate declares an axis whose name promises a conceptual surface but whose extractor only walks a syntactic subset of that surface, the gap is **invisible to every downstream phase**: there is no missing-sidecar warning (no node to lack a sidecar for), no `unresolved: true` chain hop (no chain reference to the missing node), no failed retrieval (no node to retrieve). The maintainer reads the manifest, sees the axis name, and assumes the surface is covered. The canonical incident: rev 8 (LSN-023) made the UI interaction layer a *mandatory* substrate axis; the substrate carried `ui_routes` (12 nodes — route definitions) + `ui_shell` (13 nodes — app frame + i18n + toolbar widgets); the platform shipped ~550 React components under `odd-platform-ui/src/components/**/*.tsx`. The 530 missing components — the OwnerAssociations admin triplet, the per-DataEntity Overview tab's 14 sub-panels, the `EntityClassItem` / `EntityTypeItem` badges, the form / modal / autocomplete trees driving every Management surface — had no substrate node at all, were never enriched, never mined, never threaded into a chain, never retrievable. Four days and 122 SHB threads and 36 graduations passed before a maintainer-led question (*"why are these two features still not in the ontology?"*) surfaced the gap. **Failure F is the substrate-layer analogue of Failures B/C/D** — one layer *below* per-file transcription: where Failure B is structurally complete + semantically empty (heuristic emits node, no meaning), Failure F is structurally **incomplete** (heuristic doesn't emit the node at all) — and the methodology has no rule that says "verify your axis covers its conceptual surface" the way it has rules that say "interrogate your nodes" (rev-4 Stress Protocol) and "reflect on your features" (rev-5 feature-reflector). The class generalises beyond UI: `controllers` may cover `@RestController` but miss WebSocket / SSE / message-listener / scheduled-job handlers; `config_prefixes` may cover `@ConfigurationProperties` but miss scattered `@Value` reads / env-var consumers / SpEL expressions; `tests` may cover JUnit files but miss fuzz harnesses, Pact contracts, k6 scripts; `migrations` may cover Flyway SQL but miss trigger definitions, stored procedures, materialized-view refreshes. The fix is **Rule 20 + Type-3.5 probes** (section 7): every declared axis carries a written conceptual ceiling (a back-of-envelope upper bound) and is probed at registration time; an axis whose enumeration drops below 30% of its ceiling (default; per-axis overrideable) is treated as MISSING for downstream purposes, not "partially covered". Case-law: `retrospectives/LSN-025`.

The approach defeats Failures A-D by **layering with interrogation, bottom-up AND top-down**: heuristic gives stable IDs cheaply (the scaffold); LLM agents enrich those IDs with semantic content (the meat); **the analyser runs a Stress Protocol on every node to interrogate boundaries, name-behavior drift, ordering semantics, auth-mode posture, resource limits, and request-input naming alignment — generating runnable probe-skeletons when the answer requires runtime**; reducers turn per-file signals into emergent cross-file findings (the payload); **the feature-reflector runs a top-down product-owner pass on each composed feature flow, generating falsifiable hypotheses and validating them against the implementation chain — surfacing contradictions that no per-file pass can see** *(rev 5)*; the coherence-sweep catches cross-artefact contradictions. The layering matches the 2024-2025 industry consensus (LazyGraphRAG / Aider repo-map / Sourcegraph-deprecating-embeddings / KG-CodeGen-May-2025) and was validated through the substrate ADR's research pass — see `adrs/drafts/research/agentic-code-ontology/` for the long-form. The interrogation discipline is the rev-4 contribution; the reflection discipline is the rev-5 contribution — see sections 14 and 15. Failure E is defeated differently — not by a pipeline layer but by an independent audit *of* the pipeline; that is the rev-6 contribution, the meta-review subsystem of section 16. Failure F is defeated at the substrate registration boundary — every axis carries a conceptual ceiling and is probed for surface coverage before its enumeration is trusted (Rule 20, Type-3.5 probes); that is the rev-12 contribution.

---

## 3. The four-layer architecture (with Layer 4b in rev 5)

| Layer | Lives in | What it produces | Why this layer exists |
|---|---|---|---|
| **1. Substrate** (deterministic) | `lineage/_extractor/` Python driver; tree-sitter parsers per language | `nodes.jsonl` (one node per code entity) + `edges.jsonl` (containment, calls, configures, exposes, mounts, references) + `manifest.yaml` (commit anchor, axis versions) | Stable IDs are the join key for everything downstream. Deterministic enumeration is cheap and never hallucinates a node. A heuristic walker is the ONLY layer that should be heuristic. |
| **2. Per-node enrichment** (agentic, with **Stress Protocol** in rev 4 + **Category F** in rev 5) | `.claude/agents/file-analyser.md`; one Markdown sidecar per node at `lineage/{repo}/understanding/{slug}.md`; zero-or-more analyser-emitted probe-skeletons at `lineage/{repo}/probes/P-{NNN}.yaml` | Per-node `understanding`, `concepts`, `dependencies_semantic`, `tests_coverage_semantic` (with per-behaviour `test_class`), `docs_link_semantic`, `implicit_adrs`, `bugs_limitations_corner_cases`, **`stress_findings`** *(rev 4, with `request_inputs` sub-category in rev 5)*, `security`, `performance`, **`upstream_callers`**, **`downstream_side_effects`**, `sources`, `confidence_per_field` | A subagent reads ONE node end-to-end, walks 1-hop neighbours when material, WebFetches the live published doc for any claimed link, **runs the Stress Protocol on every trigger detected in the code (tunables / name-behavior pairs / orderings / auth gates / resource boundaries / request-input naming alignment — each with a fixed question list, each question answered via trace-answer with `STATIC-INFERRED` evidence, OR probe-answer with a runnable skeleton emitted under `probes/`, OR reference-answer pointing at another sidecar)**, and emits a sidecar a maintainer would be proud to ship. Each sidecar carries the call-graph references (upstream + downstream) and user/externally-observable consequences, enabling layer-4 composition. Per-file context window stays manageable; semantic content + interrogation are the deliverables. Schema v0.5.0 (rev 5). |
| **3. Cross-file reducers** (agentic, cross-file) | `.claude/agents/{concept-merger,adr-archaeologist,doc-gap-finder,test-coverage-mapper,feature-advisor}.md`; outputs at `lineage/{repo}/{concepts.yaml,implicit-adrs.md,refactoring-scopes.md,doc-gaps.md,test-map.yaml,feature-walks/}` | Cross-sidecar emergence: shared concepts; recurring ADR patterns; doc divergences; test gaps; impact assessments for proposed features | Single-file enrichment can't see patterns. The reducer steps back across all sidecars + canonical docs and surfaces what no single sidecar could. The 18-sidecar "DISABLED-mode bypass" finding in ODD's `investigator-log.md` is the proof: emergence only the cross-product can produce. |
| **4a. Feature-anchored composition** (agentic, cross-layer, bottom-up) | `.claude/agents/feature-flow-builder.md`; output at `lineage/{repo}/feature-flows.yaml` + `feature-flows/detail/F-NNN.yaml` | Per-feature observed-vs-expected user-observable behaviour, composed from entry-point sidecar chains. Each entry: contributing_nodes, amplification_factor, cross-layer drift annotations, and a 4-class test matrix (unit / integration / performance / security). | Reducers compose by *concept*. The feature layer composes by *user-observable boundary*. The view_count doubling bug (LSN-017) cannot be surfaced by either layer 2 or layer 3 alone — the cross-layer product (UI dispatch-multiplicity × backend per-call delta) lives only at the system's external boundary, which is layer 4a's home. |
| **4b. Top-down product-owner reflection** *(rev 5, agentic, top-down)* | `.claude/agents/feature-reflector.md`; output at `lineage/{repo}/feature-reflections/detail/{F-NNN}.yaml` + `feature-reflections/index.yaml` | Per-feature stepped-back product-owner narrative + 5-15 falsifiable user-facing hypotheses + per-hypothesis verdicts (confirmed / contradicted / partial / probe-needed) traced through the implementation chain. Contradictions become bug/caveat candidates; probe-needed verdicts emit probe-skeletons; doc-claim-vs-code mismatches surface as DOC-GAP candidates. | Bottom-up composition (4a) threads the chain mechanically; it does not ASK whether the assembled chain delivers what the feature promises users. The Activity Feed `userIds` bug (LSN-020) is locally consistent at every layer and only surfaces when a top-down pass asks *"when a user passes userIds=[42], what do they EXPECT to see, and does the chain deliver that?"*. Layer 4b runs the top-down pass mechanically: hypotheses from endpoint shape / DTO names / UI labels / pillar mission; verdicts traced back through the chain. |

**Rule of layering**: lower layers never depend on higher layers. The substrate doesn't read sidecars. Sidecars don't read each other (per-node scope only — but they DO record cross-references for layer 4). Cross-file reducers don't read source code (they read sidecars). Feature-flow composition reads sidecars + reducer outputs + the substrate's edge graph (it does not re-read source code). **Feature-reflector reads composed feature flows + contributing sidecars + system-mission.md + concepts.yaml + live docs as cross-reference (it does NOT re-read source code; the one exception is a single-line validation read recorded as `source_read_for_validation: true` for the next file-analyser refresh)** *(rev 5)*. The flow is one-way; the dependencies are clear.

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
| **`feature-flow-builder`** *(rev 2)* | All sidecars' `upstream_callers` + `downstream_side_effects` blocks; substrate's edge graph; concepts.yaml; `test_axis` classifications | `feature-flows.yaml` + `feature-flows/detail/F-NNN.yaml` | Per-feature observed-vs-expected user-observable behaviour, composed from entry-point sidecar chains. `amplification_factor` where multipliers stack across layers; `cross_layer_drift` annotations; per-feature 4-class test matrix; cross-references to refactoring-scopes / doc-gaps / test-gaps that contribute. |
| **`feature-reflector`** *(rev 5)* | One composed feature flow at a time (`feature-flows/detail/F-NNN.yaml`); contributing sidecars; `system-mission.md`; `concepts.yaml`; live docs via WebFetch (cross-reference only) | `feature-reflections/detail/F-NNN.yaml` + `feature-reflections/index.yaml` | Top-down product-owner reflection: a stepped-back narrative (3-5 paragraphs) of what the feature delivers to a user; 5-15 falsifiable hypotheses derived from endpoint shape / DTO field names / UI labels / pillar mission / negative-space user expectations; per-hypothesis verdicts (confirmed / contradicted / partial / probe-needed) traced through the implementation chain. Contradictions are the cross-file intent-vs-implementation drifts no single sidecar can see. Bug-candidate / caveat-candidate / doc-drift / validation-gap findings route into the backlog and downstream registries. |

The seven reducer outputs together form the **payload**. The substrate + sidecars are inputs to the payload; the payload is what a maintainer consumes day-to-day. `feature-flows.yaml` is the **product surface** — it expresses the system as users observe it, anchored on code-derived truth. `feature-reflections/` is the **product critique** — for each feature, the user-facing hypotheses + verdicts that expose where the implementation does not deliver what the feature promises.

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
13. ***(rev 4, extended in rev 5)* Interrogate, do not transcribe — the Stress Protocol is non-negotiable.** The file-analyser does NOT emit a sidecar without first running the Stress Protocol on the code it read. **Six trigger categories** — **tunables** (every hardcoded number / default / limit), **name-behavior pairs** (every method or endpoint whose name promises observable behavior), **orderings** (every `ORDER BY` / `LIMIT` / paginate / sort), **auth gates** (every endpoint × 4 auth modes × unauthenticated × wrong-role), **resource boundaries** (every `@Transactional` / lock / cache / idempotency site), **request-input naming alignment** *(rev 5 — Category F)* (every named query parameter / request DTO field / path variable / header — does the implementation's actual scope match the name's promise? what about available-but-unused columns? what about parameter-name-vs-SQL-column drift across the chain?). Each trigger fires a fixed question list (see section 14 for the full catalogue). Each question is answered via ONE of: (a) **trace-answer** — the answer is in the code + 1-hop neighbours; record `confidence: STATIC-INFERRED` + `file:line` evidence; (b) **probe-answer** — answer requires runtime; the analyser writes a concrete runnable probe-skeleton under `lineage/{repo}/probes/P-{NNN}.yaml` (`emitted_by: file-analyser`, `status: pending-stress-protocol`); the sidecar records `confidence: PROBE-NEEDED` + the `probe_id`; (c) **reference-answer** — answer lives in another sidecar; record `confidence: REFERENCE` + the `node_id` of the sidecar that owns it. **No triggered question may be skipped.** A sidecar with `stress_findings.stress_summary.triggers_total == 0` on a node that visibly contains numeric literals, method-name verbs, endpoint annotations, ORDER BYs, `@PreAuthorize` annotations, or named request inputs is REJECTED. The methodology generates its own questions — it does not ask the maintainer to remember things. The Stress Protocol is what closes Failure C (section 2). Case-law: `retrospectives/LSN-019` (Categories A-E); `retrospectives/LSN-020` (Category F). The file-analyser system prompt lives in `.claude/agents/file-analyser.md` at version `file-analyser/0.5.0` (or newer).
14. ***(rev 4, extended in rev 5)* Coverage is a stress-verified-AND-reflection-verified percentage, not a node-touched percentage.** The honest metric has two complementary axes: **stress-verified coverage** = `(STATIC-INFERRED + PROBE-VERIFIED) / total stress questions across all sidecars` (the bottom-up interrogation axis); **reflection-verified coverage** *(rev 5)* = `(confirmed + contradicted-with-cited-failure-modes) / total hypotheses across all feature-reflections` (the top-down reflection axis — `partial` and `probe-needed` count as in-flight, not verified). The vanity metric `(nodes_with_sidecar / total_substrate_nodes)` is kept for trend continuity but is NEVER the headline. A registry with 100% node-touched coverage and 0% on either honest axis is a registry of descriptive transcription. The maintainer's reading of "X% coverage" must mean *"X% of operator-observable claims have been interrogated against the code (Stress Protocol) AND X% of user-facing feature promises have been traced through the assembled chain (reflection)"*, not *"X% of nodes have some sidecar"*. The `coverage.py` reducer's dashboard renders three axes side-by-side, with explicit framing distinguishing them.
15. ***(rev 5)* Reflect, do not just compose — the top-down feature-reflector pass is non-negotiable for every feature flow.** After `feature-flow-builder` produces or updates a `feature-flows/detail/F-NNN.yaml`, the `feature-reflector` subagent runs a top-down pass on that feature: a stepped-back product-owner narrative (3-5 paragraphs, every claim cited), 5-15 falsifiable user-facing hypotheses derived from endpoint shape / DTO field names / UI labels / pillar mission / negative-space user expectations, and per-hypothesis verdicts (`confirmed` / `contradicted` / `partial` / `probe-needed`) traced through the implementation chain. Contradictions are surfaced as bug-candidate or caveat-candidate findings with operator-visible failure modes enumerated; `probe-needed` verdicts emit probe-skeletons (`emitted_by: feature-reflector`, `status: pending-reflection-verification`); doc-claim-vs-code mismatches surface as DOC-GAP candidates. **Documentation is a downstream cross-reference, never the source of intent** — intent is reasoned from code-internal signals (names, DTOs, UI labels, pillar anchor, available-but-unused data). A feature flow without a refresh-aged reflection is incomplete; a feature flow with a reflection containing zero hypotheses on a non-trivial feature is rejected at validation. Case-law: `retrospectives/LSN-020`. The feature-reflector system prompt lives in `.claude/agents/feature-reflector.md` at version `feature-reflector/0.1.0` (or newer).
16. ***(rev 6; rev 9)* Periodic independent meta-review is mandatory — the methodology audits itself.** A methodology graded only from inside its own frame cannot see its own blind spots (Failure E, section 2). On a cadence — per milestone, never per-commit — the **methodology meta-review** (section 16) runs: a single `methodology-reviewer` agent that traces the whole current methodology (`APPROACH.md` every section + every revision, the ADRs, the agent contracts, the skills, the playbooks, the case-law, the live artefacts), diffs against the prior review, anchors on the explicit written `target.md` (§16.2) rather than an implicit notion of "done", runs *fresh, blind* spot-checks against the real codebase, and emits real gaps + real improvement proposals — including subtraction. Findings are candidates the maintainer triages — the review never auto-edits the methodology. It is a Claude-family agent auditing Claude-built artefacts: its correlated-blind-spot risk is HIGH and permanent, so verdicts are weighted by cited evidence and never by the reviewer's own confidence, and the review augments rather than replaces the maintainer's own audit. It is validated by a maiden acceptance gate before its reports are trusted (section 16). Runs via `/panel`. Rev 9 replaced the rev-6 six-expert Adversarial Review Panel with the single reviewer. Case-law: `retrospectives/LSN-021` (the original trigger — no independent oracle); `retrospectives/LSN-024` (the panel re-listed stale findings and missed a whole revision).

17. ***(rev 8)* The operating stance of section 0 is non-negotiable.** This is reverse engineering of a user-facing product; every layer is run as Linus Torvalds (the engineering bar) AND as a senior product owner (the feature bar); the user-facing surface is the primary object of analysis. Analysis performed below this bar is defective work, not a smaller scope — it is rejected at review regardless of which gate did or did not name the specific check that was skipped. "I was not instructed to check X" is never a defence. Explaining a miss away as "structural" / "frame-blindness" / "no mandate" is the junior engineer's excuse and is itself a violation. Case-law: `retrospectives/LSN-023`.

18. ***(rev 8)* The user-facing surface is mandatory; a UI-incomplete feature is incomplete.** For any product humans use through a UI, the UI interaction layer — the component / form / modal / interactive-control tree — is a MANDATORY substrate axis, never one of the optional "3-5 highest-leverage" of section 6 Step 3. A feature flow whose UI entry surface is an `unresolved` reference is `ui-incomplete`: it may not be marked analysed or `done`, and any finding it emits that depends on UI-layer meaning (what a request field means to the user, what a form does, whether an affordance is intended) is provisional and carries a `ui-unverified` flag. The feature-flow-builder does not mint a confident drift finding (`permission_side_door`-class and similar) from a backend-only chain. Case-law: `retrospectives/LSN-023` — `F-031`'s `permission_side_door` finding for `namespace_name → getOrCreate` was emitted from a backend-only chain and was wrong: the backend serves a deliberate, labelled select-or-create combo-box.

19. ***(rev 8)* UX patterns are architectural decisions.** A reusable interaction pattern — select-or-create combo-box, confirm-before-destroy, optimistic update, master-detail, the admin-tab shell — is a deliberate, repeated, structural design choice; it passes the adr-archaeologist's 3-question wisdom test and is an ADR candidate. The adr-archaeologist surfaces UI/UX-pattern ADRs alongside backend-architecture ADRs. A `getOrCreate`-family backend behind a select-or-create combo-box is the pattern's implementation, not a refactoring-scope "side-door".

21. ***(rev 13)* Scanner ↔ ontology fusion: feature-flows is primary; ontology is a clue source, not ground truth; write-back is annotate-only.** Scanners with `ontology_feed.enabled: true` iterate `lineage/{repo}/feature-flows/detail/F-*.yaml` as the PRIMARY investigation target — every in-scope F-NNN gets read end-to-end (`description`, `chain[]`, `observed_vs_expected.facets[]`), verified against code via the clue-class ladder (`file_exists` / `assertion_about_code` / `cross_layer_behaviour` / `doc_drift`), and cross-checked against its expected doc location. `doc-gaps.md` is a dedup/priority hint only — a feature absent from doc-gaps is NOT presumed documented. Write-back is annotate-only frontmatter (`scanner_reviews:` append-only list keyed by `(scanner_id, scan_run_date)`); the reducers remain the sole writers of feature semantics. Per-scan-run consultation budgets are hard caps (`feature-reflector` 3, `odd-sme` 2, `graph-retriever` 5); excess → backlog escalation, never silent drop. New SoT class `Ontology` is additive, always co-cited with the underlying primary-source class. Every emission stamps `ontology_commit_consulted:` and aborts if substrate coverage <50% of intended scope. Full 13-rule taxonomy at `adrs/drafts/research/scanner-ontology-fusion/PITFALLS.md` (D1-D13). Case-law: rev 13 trigger anchor in `adrs/drafts/research/scanner-ontology-fusion/SUMMARY.md`; LSN entry filed if a regression class surfaces from pilot data.

20. ***(rev 12)* Every declared substrate axis carries a written conceptual ceiling and is probed for surface coverage.** An axis name promises a conceptual surface (*"UI"*, *"controllers"*, *"config"*, *"tests"*, *"migrations"*); the extractor enumerates a specific syntactic subset of that surface (`@RestController`, `@ConfigurationProperties`, `*.tsx` files matching pattern X). When the subset is much smaller than the surface, the gap is invisible to every downstream phase because **there is no node to lack a sidecar, no chain reference to be unresolved, no retrieval to fail** — the surface simply does not exist in `nodes.jsonl`. At axis registration time, the maintainer writes (a) one sentence naming the conceptual scope, (b) a back-of-envelope **conceptual ceiling** (the rough upper bound on the count the extractor should produce — `find … | wc -l` is fine), and (c) registers a **Type-3.5 substrate-coverage probe** (section 7) that compares `nodes_produced` to `conceptual_ceiling` on every full scan. Default threshold: `nodes_produced < 0.3 × conceptual_ceiling` ⇒ axis is **MISSING** for downstream purposes — not "partially covered" — and the maintainer is notified to extend the extractor or rename the axis to its actual narrow scope. The 30% threshold is overrideable per-axis (a sparse-by-design axis declares its own expected ratio); the rule's value is forcing the ratio to be **named**, not adjudicating the line. When a feature-flow-builder chain marks a hop `unresolved: true` AND the hop's conceptual surface has a declared axis whose ceiling exceeds the extractor's count, the unresolved hop is a **substrate-coverage gap**, not a missing-sidecar gap — the fix is to extend the extractor or declare a new axis, not to fire `/enrich` against a node the substrate didn't emit. The class of failure is not UI-specific: it applies to any axis whose name promises more than its enumerator captures (see Failure F in section 2 for the cross-domain examples table). Case-law: `retrospectives/LSN-025`.

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

***(rev 8 — mandatory, exempt from the 3-5 triage above.)*** For any product a human uses through a UI, the **UI interaction layer is a mandatory axis** — the component / form / modal / interactive-control tree, not merely route mounts (`ui_routes`) and the app shell (`ui_shell`). ODD's original axis set — `controllers + openapi_tags + ui_routes + ui_shell + config_prefixes` — failed this: it captured route mounts and the app frame, but the screens, forms, modals, and combo-boxes where the user actually acts had no axis, so the ontology described the machinery and skipped the product. The user-facing surface is the primary object of analysis (section 0.3); it is never triaged away as "not in the top five." Case-law: `retrospectives/LSN-023`.

***(rev 12 — mandatory for every axis you declare, UI or not.)*** When you register an axis in `lineage/_extractor/`, also write — in the extractor module's docstring AND in `manifest.yaml`'s axis block — **one sentence naming its conceptual scope** (the operator-readable category, *"every React component file under `src/components/**/*.tsx` exporting a default React component"* / *"every Spring `@RestController` method"* / *"every Flyway migration file under `db/migration/V*.sql`"*) and **a back-of-envelope conceptual ceiling** (the rough upper bound — `find … | wc -l` or `grep -lR '@…' | wc -l` is fine). Register a **Type-3.5 substrate-coverage probe** for the axis: on every full scan, the probe compares `nodes_produced` to `conceptual_ceiling` and flags axes whose enumeration is below 30% of their ceiling as **MISSING** (not "partially covered") for downstream purposes. This is **the antidote to rev-8's incomplete fix** — rev 8 made UI mandatory but the substrate's `ui_routes` + `ui_shell` axes only enumerated 25 of ~550 React components in the target repo, and every downstream phase trusted the substrate as complete for four days and 122 SHB threads before the gap surfaced. The lesson generalises: `controllers` may cover REST but miss WebSocket / SSE / message-listener handlers; `config_prefixes` may cover `@ConfigurationProperties` but miss scattered `@Value` reads + env-var consumers; `tests` may cover JUnit files but miss fuzz harnesses, Pact contracts, k6 scripts; `migrations` may cover Flyway SQL but miss trigger definitions, stored procedures, materialized-view refreshes. **The axis name promises a surface; the extractor enumerates a subset; the gap is invisible until the ratio is named.** Case-law: `retrospectives/LSN-025`; rule: Rule 20 (section 5).

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
| **Type-3.5 *(rev 12)*** | **Substrate-axis surface-coverage probes** | **For every declared axis, the extractor's `nodes_produced` is compared to the axis's written `conceptual_ceiling`. An axis with ratio < 30% (default; per-axis overrideable) is reported as `MISSING` — not "partially covered" — so downstream phases (file-analyser, shoebox, feature-flow-builder, retriever) cannot treat it as ground truth. This is the antidote to Failure F (axis declared but enumerates only the entry-points / shell of its conceptual surface). The probe runs on every full scan and writes a `manifest.yaml`-side coverage block: `{axis: ui_components, ceiling: 553, produced: 534, ratio: 0.97, verdict: OK}`. Case-law: LSN-025.** |
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

- **No *external or persisted* vector store.** Per `retrospectives/LSN-016`, the failure modes the approach defeats are structural blind-spots, not "couldn't find a similar text" problems — so embeddings never *replace* the agentic substrate, there is no external-API embedding service, and no hosted/persisted vector DB. Through rev 6 this was a blanket "no vector store / RAG layer"; **rev 7 scopes it precisely** (see §17). A *local, ephemeral, rebuilt-from-files, query-time* index — embedding distilled sidecar prose (never raw code) to find entry points for deterministic graph traversal — is **permitted**, and is what the derived graph query layer is. Sourcegraph's 2024 deprecation of Cody embeddings deprecated embeddings of *raw code chunks* against a *persistent* index; its one substantive reason (index staleness) is exactly what rebuilding from the canonical files each run eliminates. The substrate stays agentic; the index is a disposable accelerator, never a source of truth.
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
| **F — Request-input naming alignment** *(rev 5)* | Every path parameter (`@PathVariable`, `{id}`); every query parameter (`@RequestParam`); every field of every request body DTO (POST/PUT/PATCH); every header read by the handler (`@RequestHeader`); every local-variable name that implies a domain entity used to filter / select / route to a specific column. Plus inverse-direction triggers: every SQL/JOOQ WHERE predicate where the variable name and column name diverge semantically; every column read in JOIN/SELECT but absent from WHERE where the column name suggests the user expected to filter by it (the "available-but-unused" smell). | Q1: What does the input NAME promise the caller, in plain user-facing English? Q2: When the request supplies this input, what does the implementation actually USE it for (trace through the chain — service → repository → SQL)? Q3: Does the implementation's actual scope MATCH the name's promise? Four shapes — MATCHES / TRANSLATES_LEGITIMATELY (with cited reason) / TRANSLATES_SILENTLY (drift) / UNRESOLVED (downstream sidecar owns the trace). Q4: For TRANSLATES_SILENTLY: enumerate the operator-visible failure modes (empty results / wrong results / cross-data inconsistencies / retroactive rewrites). Q5: Is there a column / field / variable that DOES match the input's name and is NOT being used? |

**Category triggers are language-agnostic in concept; language-specific in detection.** A Java project triggers Category D on `@PreAuthorize`; a Django project triggers it on `permission_classes`; a Rust Axum service triggers it on `axum::middleware::from_fn`. A Java project triggers Category F on `@RequestParam` / `@PathVariable` / `@RequestHeader` / Java DTO field names; a Django project triggers it on URL kwargs / DRF serializer fields / `request.GET`; a Rust Axum service triggers it on `Path<T>` / `Query<T>` / `Json<T>` extractors. The category exists in every project; the detection rules adapt to the stack.

**Add a category when a maintainer's empirical test exposes a class the existing six don't cover.** Categories are open-ended; rev 5 ships with six. Rev 4 shipped with five because those covered the LSN-019 incident and the surrounding ODD case-law (auth-mode posture from REFACTOR-185, ordering drift from listMostPopular, tunable boundaries from page sizes, name-promise drift from miscellaneous controller methods, resource boundaries from the housekeeping jobs). Rev 5 added Category F because LSN-020 exposed the cross-layer parameter-name-vs-implementation drift class (Activity Feed `userIds` filter binds to `OWNER_ID`); the existing Category B caught method-name drift but had no equivalent for the more numerous parameter-name drift surface. The next maintainer test will likely expose Category G.

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

The six categories in section 14's table are universal; their detection rules are stack-specific (one paragraph per category in the new project's `file-analyser.md` instance, naming the language-specific triggers — `@PreAuthorize` for Spring, `permission_classes` for DRF, `axum::middleware::from_fn` for Axum, etc.).

### Cross-references

- `retrospectives/LSN-019` — the case-law that motivated rev 4.
- `retrospectives/LSN-020` *(rev 5)* — the case-law that motivated Category F + Layer 4b.
- `.claude/agents/file-analyser.md` rev `file-analyser/0.5.0` — the Stress Protocol (Categories A-F) baked into the system prompt; the universal source of truth for category triggers + question lists + answer forms.
- `.claude/agents/probe-runner.md` — the downstream consumer that resolves `pending-stress-protocol` probes into measured truths.
- `lineage/_extractor/registry-shard/coverage.py` — the reducer that renders the honest stress-verified axis alongside the static-coverage axis.
- `adrs/drafts/feature-anchored-ontology.md` rev 4-5 (pending) — the ADR update incorporating rules 13-15 and sections 14-15 into the formal methodology design.

---

## 15. Top-down product-owner reflection — Layer 4b (rev 5)

*(Added 2026-05-21 after the maintainer's empirical test of the Activity Feed surfaced a parameter-name-vs-implementation drift the rev-4 Stress Protocol did not catch. The query parameter `userIds` on `GET /api/activity` binds to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` at the SQL layer — the parameter promises filtering by users-who-performed-the-action, the implementation filters by owners-of-entities via the user-owner mapping; users without an owner mapping cannot be filtered, owner-user association changes retroactively rewrite past attribution, the actual actor column `activity.created_by` is JOINED but never FILTERED. Each per-file sidecar was internally consistent; the Stress Protocol's Category B caught METHOD-name drift but had no equivalent for PARAMETER-name drift; and no layer ran a top-down pass to ask "what does this feature promise users, and does the assembled chain deliver it?". Rev 5 closes both gaps: Category F bottom-up at Layer 2 (section 14) + Layer 4b top-down. Case-law: `retrospectives/LSN-020`.)*

### Why this layer exists

Layers 1-4a are all bottom-up. Layer 1 enumerates code units; Layer 2 enriches each unit with semantic content + Stress Protocol interrogation; Layer 3 reduces across units; Layer 4a composes user-observable chains from entry points. **Every layer's question is "what does the code DO?"** None ask "what does the assembled feature PROMISE users, and does the implementation deliver it?". This is the cross-file analogue of Failure C: the per-file interrogation discipline (Stress Protocol) closed the per-file transcription gap; the cross-file reflection discipline (this layer) closes the per-feature promise-vs-delivery gap.

Bottom-up alone produces sidecars and feature flows that mechanically describe what each layer does and how the layers compose — but it does NOT challenge the assembled product against the user's expectation. A senior engineer, after composing the chain, would step back and ask:

- *"This feature is called 'Activity Feed' and it takes a parameter called `userIds`. If I were a user passing `userIds=[42]`, what would I expect to see? Activity rows where Alice (user 42) performed the change. Does the chain deliver that?"*
- *"This feature is called 'Most Popular Tags' and it returns 30 rows. If I were a user opening 'Top Tags', what would I expect? The 30 tags assigned to the most data entities right now. Does the chain deliver that?"*
- *"This feature is called 'Activity Feed' and the docs say it shows audit history. If I were a security reviewer, what would I expect? Every RBAC mutation, every owner change, every data-entity edit — a complete audit trail. Does the chain deliver that?"* (Spoiler: the F-006 audit-silence pattern proves it doesn't — RBAC mutations are schema-locked out by `activity.data_entity_id NOT NULL`.)

The first question is the LSN-020 case. The second is the LSN-019 case (caught by Stress Protocol Category B, BUT a top-down hypothesis would also catch it). The third is a 9-sidecar audit-silence pattern the methodology HAS already surfaced through bottom-up reducer aggregation — but the surfacing is anchored in technical drift_class facets, not in the user-facing question "is the audit trail complete?". A top-down hypothesis frames the failure as the user sees it.

Layer 4b makes this discipline mechanical: every feature flow gets a reflection; every reflection generates falsifiable hypotheses derived from code-internal signals; every hypothesis is validated against the implementation chain.

### The universal shape — hypothesis generation seeds

The reflection's quality is determined by hypothesis quality. Hypotheses come from EIGHT seed sources, applied to every feature:

| Seed source | What it produces |
|---|---|
| **Endpoint shape** | One hypothesis per named query parameter / DTO field / path variable — what the input promises and what behaviour follows from supplying it ("when X is passed, Y happens"). |
| **Response shape** | One hypothesis per prominent response field — what it represents in the user's mental model ("the `created_by` field shows who performed the action, not who owns the affected entity"). |
| **View-mode dispatches** | For each branch of a switch/strategy on the entry-point side (e.g. `type=ALL/MY_OBJECTS/UPSTREAM/DOWNSTREAM`), one hypothesis per branch about the filtering scope. |
| **UI labels** | When UI sidecars are in the chain, one hypothesis per labeled UI control (button text, filter chip name, form field label) about the implementation behind the label. |
| **Pillar mission anchor** | For each `primary user action` enumerated in `system-mission.md`'s pillar for this feature, one hypothesis about whether the chain delivers it. |
| **Cross-pillar promises** | For each cross-pillar relationship in `system-mission.md`, one hypothesis about the boundary behaviour. |
| **Doc-claim seeds** | For each user-facing claim in the live doc page, one hypothesis (confirmed if code matches doc; contradicted if not — doc is a cross-reference, never a source of truth, but a doc claim that contradicts code IS still a hypothesis worth surfacing). |
| **Negative-space** | For each user expectation that would be NORMAL but the chain might not deliver (e.g. "deleted owner's historical activity rows still show original actor"). These are the highest-leverage catches. |

Aim for 5-15 hypotheses per feature. Below 5 suggests the feature is truly tiny OR the agent stopped generating early; above 15 suggests the feature is over-large and should be split.

### Verdict shapes

Each hypothesis carries a verdict from a fixed set:

| Verdict | When | What it produces downstream |
|---|---|---|
| **`confirmed`** | Implementation does what hypothesis predicts; trace cited | Adds to confidence in the feature's user-promise alignment. |
| **`contradicted`** | Implementation does something else; trace cited; operator-visible failure modes enumerated | The HIGHEST-priority finding class. Routes to bug-candidate (fix proposed) or caveat-candidate (document the actual behaviour). Severity HIGH unless cosmetic. |
| **`partial`** | Hypothesis is partly true (works in some conditions, not others); gap described; both sides cited | Routes to caveat-candidate, sometimes bug-candidate. Severity MEDIUM. |
| **`probe-needed`** | Verdict requires running the system; probe-skeleton emitted at `lineage/{repo}/probes/P-NNN.yaml` (`emitted_by: feature-reflector`, `status: pending-reflection-verification`) | Probe-runner subagent picks up on next sweep. Reflection's verdict updates from `probe-needed` to `confirmed` or `contradicted` based on the measured outcome. |

A `contradicted` verdict without `operator_visible_failure` enumeration is rejected — the WHOLE POINT is for the maintainer to see what users encounter.

### Run cadence

The feature-reflector runs **once per feature flow per substantive refresh**. Triggers:
- A feature-flow detail file (`feature-flows/detail/F-NNN.yaml`) is created (new feature).
- A feature-flow detail file is extended with a new entry point or new contributing nodes.
- A contributing sidecar's `understanding` / `upstream_callers` / `downstream_side_effects` / Category-F `request_inputs` block changes substantively (i.e. the chain's behaviour shifted in a way the reflection might re-verdict).
- The maintainer manually re-fires via `/reflect-feature F-NNN`.

If a prior reflection exists, the reflector PRESERVES `maintainer_curated: true` hypotheses verbatim and refreshes only the auto-derived hypotheses + verdicts. Past contradictions that are now confirmed (because the code changed) move into a `superseded_by_refresh` block with the timestamp + the new verdict — the audit trail survives.

### Bootstrapping a new project

When porting this methodology to a new project, the reflector activates in step 6 of the cycle:

```
1. Run substrate scan         → nodes.jsonl + edges.jsonl
2. Run domain-extractor       → system-mission.md       ← Layer 0 (rev 3)
3. Maintainer reviews mission → curates pillar names
4. Run enrichment batches     → sidecars + analyser-emitted probes  ← Layer 2 with Stress Protocol (rev 4-5, includes Category F)
5. Run probe-runner on pending-stress-protocol probes → resolves PROBE-NEEDED → PROBE-VERIFIED
6. Run reducers + feature-flow-builder + feature-reflector + coherence-sweep  ← Layers 3, 4a, 4b
7. Run probe-runner on pending-reflection-verification probes → resolves reflection PROBE-NEEDED → PROBE-VERIFIED / PROBE-CONTRADICTED
```

The reflector's prompt is stack-agnostic at the framework level (system prompt in `.claude/agents/feature-reflector.md`) — the maintainer authoring the new project's `system-mission.md` + `concepts.yaml` + per-language `file-analyser.md` does NOT need to author a new reflector; the existing one composes correctly against any feature flow.

### Cross-references

- `retrospectives/LSN-020` *(rev 5)* — the case-law that motivated this layer.
- `.claude/agents/feature-reflector.md` rev `feature-reflector/0.1.0` — the system prompt + output schema + worked example.
- `.claude/skills/reflect-feature/SKILL.md` — the maintainer-facing slash command.
- `lineage/{repo}/feature-reflections/index.yaml` + `feature-reflections/detail/F-NNN.yaml` — the canonical output paths.
- `.claude/agents/probe-runner.md` — the downstream consumer that resolves `pending-reflection-verification` probes.
- `adrs/drafts/feature-anchored-ontology.md` rev 5 (pending) — the ADR update incorporating rule 15 and section 15 into the formal methodology design.

---

## 16. The meta-review subsystem — methodology meta-review *(rev 6; rev 9)*

Sections 0-15 and 17 describe the ontology-building **pipeline** and its query layer. This section describes a subsystem different in kind: one that **audits the methodology itself**. It is not a pipeline layer and not a probe class. It is the methodology's *proactive* self-correction loop — sibling to the *reactive* case-law loop of section 8.

### 16.1 Why it exists — Failure E

The pipeline is graded from inside its own frame. The probe protocol (section 7) lives in this document and is largely maintainer-seeded; `coherence_sweep.py` checks only internal consistency; `/review` and `/probe` are per-change. The one genuinely independent oracle is the maintainer's hand-picked spot-check — and it keeps finding gaps the pipeline's own probes did not. That is Failure E (section 2): a methodology graded only by the minds who built it accumulates undetected blind spots and cannot tell convergence from thrash. The meta-review is the standing, repeatable reproduction of that independent oracle — not as good as a human who knows the system (see 16.3), but structurally *outside*: it traces the whole current methodology, anchors on primary sources, and reviews adversarially by mandate.

### 16.2 The design — one tracing review *(rev 9)*

Rev-6 answered Failure E with the **Adversarial Review Panel** — six expert subagents on six axes + a chair, run in three phases. After three runs it had failed its own purpose, and rev-9 retired it. The committee was six *correlated* Claude agents (§16.3) scoring *conformance* against a fixed `target.md`; it had no memory, so it re-listed the same findings every run; and it never traced the methodology's own evolution — it re-recommended sharding `test-map/index.yaml` after rev-7 (§17) had already retired flat-file index loading. It cost ~480k-1.4M tokens a run to review a stale model of the methodology. Case-law: `retrospectives/LSN-024`.

Rev-9 replaces the committee with **one tracing review** — the `methodology-reviewer` agent, a single pass at roughly one-seventh the cost. Its mandate is four load-bearing rules:

1. **Trace the whole current methodology before any finding** — `APPROACH.md` (every section and every revision-history entry), the ADRs, the agent contracts, the skills, the playbooks, the case-law, and the live artefacts. The panel's fatal gap was reviewing a stale model; this is the structural fix.
2. **Check every finding against what the methodology has already decided** — a finding that re-proposes a solution an ADR or a revision already chose (or built) is a defect of the review (LSN-024).
3. **Diff against the prior review** — the review has memory; it reports what changed and what was acted on, and never re-lists a finding as fresh.
4. **Emit real gaps AND real improvement proposals — including subtraction.** `target.md` is read as the maintainer's yardstick, but the review also reasons generatively about how the process could be better, simpler, or cheaper. A conformance score alone is not a review.

The committee's one genuinely valuable function is kept: **fresh blind spot-checks** — name a user-observable capability, establish ground truth from the real target source first, then check whether the ontology covers it. The maintainer-owned, versioned `target.md` (a mission, measurable "hit" conditions, an on-track-vs-hit split — its existence is itself case-law, LSN-022) remains the review's input yardstick.

### 16.3 The load-bearing residual risk — correlated blind spots

The reviewer is a Claude-family agent auditing artefacts built by Claude-family agents. Same-family agents have *correlated errors* — they fail together on the same inputs. (The rev-6 committee paid six agents for a decorrelation it never delivered; rev-9 stops paying for it.) This residual risk is **HIGH and not removable by design** — genuine cross-family diversity is unavailable in the Claude Code harness. It is mitigated, never eliminated, by: **code-anchored verdicts** (a correlated model still cannot make a failing `grep` pass or a missing `file:line` resolve); the review weighting findings by cited evidence, never by its own confidence; a non-LLM gate (`coherence_sweep.py`, the `probe-runner`); and the maintainer's own human spot-audit, the one oracle outside the correlated population. The review **augments and aims** the maintainer's review — every report carries a `needs_human_verification` list — and never speaks with more authority than its cited evidence carries.

### 16.4 Validation — the review is tested, not assumed

An untested reviewer reproduces the exact failure it exists to catch. The reviewer is validated by a **maiden acceptance gate** (recall ≥ 0.80, seeded-defect detection ≥ 0.80 / ≥ 0.90 for the data-loss-security class) and a **periodic drift gate** (a fresh unannounced seeded sample each cycle). The gold set and seeded-defect corpus **must be maintainer-authored** — an LLM-authored oracle is correlated with the reviewer and worthless. Until the maiden gate passes, every review is marked `validation_status: pre-acceptance-gate` and its findings are explicitly provisional.

### 16.5 Cadence, cost, output

The review runs **periodically — per milestone, never per-commit**. One run is one agent invocation (`/panel`) — roughly one-seventh the rev-6 committee's cost. It carries a self-kill criterion: three consecutive runs with no actionable finding means the review has become the waste it audits, and it is paused. Each run emits `lineage/{repo}/meta-reviews/{date}/review.md` — a verdict, a `what_changed_since_last_review` diff, a pipeline trace, ranked gaps, ranked improvement proposals (including subtraction), fresh spot-checks, a cost section, and a trend row. Subtraction — cutting a step, retiring an artefact — is a first-class proposal class, not an afterthought.

### 16.6 Bootstrapping a new project

The meta-review ports like the rest of the framework. The `methodology-reviewer` agent and the `/panel` skill are pure-copy. Project-specific: the reviewer's target repo for the spot-checks, the **`target.md`** (the explicit, maintainer-authored definition of done — §16.2), and the **validation corpus** (the gold set + seeded-defect corpus), which is project-specific *and* maintainer-authored because it is the external oracle.

### Cross-references

- `.claude/agents/methodology-reviewer.md` — the reviewer's contract (rev 9).
- `.claude/skills/panel/SKILL.md` — the `/panel` orchestrator.
- `lineage/{repo}/meta-reviews/` — the output: `README.md`, `target.md`, `trend.md`, `spot-check-ledger.md`, `validation/`, and the dated run dirs.
- `retrospectives/LSN-021` — the case-law that created the subsystem; `retrospectives/LSN-022` — the explicit-target case-law; `retrospectives/LSN-024` — the case-law that simplified the committee to a single reviewer.
- `adrs/drafts/adversarial-review-panel.md` *(rev 6)* — the original committee design + the validation protocol + the correlated-blind-spot residual risk; superseded by rev-9, pending the maintainer's ADR update.

---

## 17. The derived graph query layer *(rev 7)*

### 17.1 Why it exists — the index-bloat ceiling

The ontology's machine-readable indices grow unboundedly. A **flat-file index forces whole-index loading**, so per-query context cost grows with total knowledge size. `test-map/index.yaml` reached **1.26 MB ≈ 315k tokens — 157% of an agent's context-load limit**; the Adversarial Review Panel (§16) rated it the run's #1 CRITICAL: the next reducer batch could not load its own prior state. Querying was brittle — hardcoded-anchor Python scripts and a `registry-search` subagent doing grep-then-Read over monoliths on purely textual overlap. This was the pre-registered second-stage trigger of `feature-anchored-ontology.md` principle 7; the literal "5 MB" proxy in that principle is corrected there (the real constraint is the agent context window).

### 17.2 The design — a disposable accelerator, files stay canonical

For each local run, deterministically build — **from the canonical files** — an **ephemeral, git-ignored property graph + vector index**, queried by **hybrid retrieval**: vector similarity finds entry points, deterministic graph traversal does the structural work, Reciprocal Rank Fusion ranks the union. `nodes.jsonl`, `edges.jsonl`, the sidecars, the reducer `detail/` files are **unchanged and remain the sole source of truth**; the graph is never hand-edited, never committed (`lineage/{repo}/graph/` is git-ignored). Per-query context cost becomes **bounded** — a query returns a small subgraph / top-k, never a whole-index load — decoupling per-query cost from total knowledge size.

Stack: an in-process graph library (`rustworkx`), exact brute-force NumPy kNN over the ~few-thousand vectors (no ANN → fully deterministic), a local ONNX embedding model via `fastembed`. **No daemon, no server, no external API** — §9 rule 12 holds; embedding generation is local and offline. Every node and edge carries `source_file:source_line`, so a query result never breaks the Gate-9 provenance chain. The embedding half is optional: if the model is unavailable the layer degrades to a pure deterministic graph-traversal index (still useful — only the semantic-entry shape is lost).

### 17.3 The reconciliation with LSN-016

`LSN-016` / §9 forbid an *external-API embedding runtime* and *RAG-as-construction-method* — they never adjudicated a *local, ephemeral, query-time* index. This layer is an **extension** of that decision, not a reversal: the substrate stays agentic (sidecars remain agent-written semantic understanding), structural findings still come from the agentic pipeline, and embeddings only *find entry points* for deterministic traversal. It embeds *distilled natural-language sidecar prose*, never raw code. §9's "no vector store" bullet is scoped accordingly in this revision.

### 17.4 Validation — shadow mode until the maiden gate passes

The layer runs **in shadow** beside the grep/Python query path; it replaces that path only when a five-family maiden gate passes (retrieval quality vs the baseline over a ~60-query maintainer-authored gold set; bounded per-query context; rebuild cost; determinism; adversarial-query rejection). The gold set is **maintainer-authored before scoring** so it cannot be reverse-fitted. Until then the Python path stays authoritative. A **graph-only fallback** is the residual-risk mitigation if the embedding half underperforms the gate.

### 17.5 Bootstrapping a new project

Copy the `lineage_extractor.graph_query` package verbatim — the loaders/projector/embedder/query facade are project-agnostic (they project whatever `nodes.jsonl` / `edges.jsonl` / sidecars / reducer `detail/` files the substrate produced). Author one project-specific artefact: `lineage/{repo}/query-gold-set.yaml`, the ~60-query maiden gate. The graph schema (node labels, relationship types) is the universal set; new emergent reducer axes get a new label + a join rule in the projector.

### 17.6 The agentic retriever *(rev 7.1)*

The query layer's first surface, the static `query()`, has a measured recall ceiling — it commits to one query formulation and one traversal shape before seeing a result, and the maiden gold-set gate failed it on all six classes. The fix is not constant-tuning; it is an **agentic retriever**. The `graph-retriever` subagent constructs a strong search query, runs a bounded retrieve→read-full-content→judge-gap→refine loop (≤10 iterations) — each refinement *discriminates away* from returned-but-wrong nodes (LLM relevance feedback) — traverses neighbours at a depth it chooses per-situation, and converges on a cited answer set. As a side-channel it emits structured *refinement suggestions* for stale / thin / mis-described nodes to `lineage/{repo}/retrieval-feedback/` — a substrate-improvement queue future enrichment batches consume — while staying strictly read-only on the graph. The `graph_query` library stays the deterministic tool layer (CLI primitives `graph-search` / `graph-node` / `graph-neighbours` / `graph-traverse`); the subagent supplies the intelligence; no external LLM (it is a Claude Code subagent). Design: `adrs/drafts/agentic-graph-retriever.md`; invoked via `/retrieve`.

**The reducer-dedup cutover.** `registry-search` — the grep-over-the-sharded-index dedup subagent — is **superseded**. The five reducers now dedup a fresh finding by a *semantic* `graph-search --label` over the graph query layer: it matches a duplicate by *meaning*, where grep matched only shared *vocabulary* (the synonym-blindness gap). The live protocol is `playbooks/registry-search-spawn.md` (rev-7.1 content); `registry-search.md` is retained only as the graph-unavailable fallback. This is the first non-shadow consumer cut over to the graph query layer — it executes `graph-query-layer.md`'s build-step-4.

### Cross-references

- `adrs/drafts/graph-query-layer.md` *(rev 7, accepted)* — the decision, the LSN-016 reconciliation, the stack, the residual risks, the implementation status.
- `adrs/drafts/agentic-graph-retriever.md` *(rev 7.1)* — the agentic retriever: the iterative loop, adaptive traversal, the suggest-don't-mutate feedback loop.
- `adrs/drafts/research/graph-query-layer/` — STACK, PRIOR-ART, SCHEMA, PITFALLS, PROBES, SUMMARY.
- `.claude/agents/graph-retriever.md` + `.claude/skills/retrieve/SKILL.md` — the retriever subagent + the `/retrieve` skill.
- `lineage/_extractor/src/lineage_extractor/graph_query/` — the package: `loaders`, `projector`, `embedder`, `graph_query`, `probe`, `config`.
- `lineage/_extractor/src/lineage_extractor/graph_query/README.md` — build / query / the ephemeral-vs-canonical contract.
- `feature-anchored-ontology.md` principle 7 — the pre-registered two-stage deferral this layer executes; its "5 MB" threshold is corrected there.
- `lineage/{repo}/query-gold-set.yaml` — the maintainer-authored maiden-gate gold set.

---

## 18. The shoebox layer — note-first reverse-engineering *(rev 10)*

### 18.1 Why it exists — the missing first stage of sense-making

The 2026-05-26 case-law named two features the methodology had completely missed: **Data Entity Staleness** (a cross-cutting `is_stale` predicate imprinted by `DataEntityMapperImpl` on every response DTO, consumed by ten UI components, with zero feature-flow anchor and zero sidecar) and **Compact lineage view-mode** (a `full: boolean` URL query param toggling rendering across two distinct lineage variants, also unanchored). Both were verified mechanically: required spec fields / UI controls with explicit operator-facing purpose and no F-NNN home. The "97.7% effective coverage" metric reported them as covered because *any* feature flow mentioned the underlying node tangentially.

The diagnosis was not "the composer is broken" or "we need more reducers." It was that the methodology had **no place for unfinished thoughts**. Layers 1-4 each demand a finalized artefact (a sidecar, a concept entry, a feature flow). An observation that names a feature the analyst can't yet anchor — a DTO field whose imprinting class is two hops off-chain; a UI control whose toggle target lives elsewhere; a cross-cutting product claim — has nowhere to go. Either it is forced into a structure prematurely (the `permission_side_door` mis-read in `retrospectives/LSN-023`) or it is dropped on the floor (staleness, compact-lineage, and almost certainly more).

Three converging bodies of work describe the gap precisely:

- **Pirolli & Card sense-making model** *(2005, "The Sensemaking Process and Leverage Points for Analyst Technology")*. Two-loop architecture: information foraging populates a **shoebox** (anything potentially relevant, no close examination yet); selected snippets promote into an **evidence file**; sense-making refines them into **schema → hypothesis → report**. Progress involves much backtracking; top-down and bottom-up mix opportunistically.
- **Von Mayrhauser & Vans Integrated Comprehension Model** *(1995/96, "Program understanding behavior during debugging of large-scale software")*. Program comprehension is *active, goal-driven, hypothesis-based*; analysts switch between top-down (domain model) and bottom-up (program model) as required, anchored by a Knowledge Base. Three levels: program, situation, top-down.
- **Votipka et al. — An Observational Investigation of Reverse Engineers' Processes and Mental Models** *(USENIX Security 2020)*. Empirical study of practicing REs: form hypotheses → systematic exploration → **note-taking** is the unit of work.

Our methodology had five of the six Pirolli-Card stages; it was missing the shoebox. The shoebox closes that gap.

### 18.2 What the shoebox is

A flat directory `lineage/{repo}/shoebox/` with one file per investigation thread under `detail/SHB-NNN-{slug}.md`. Minimal frontmatter (`**Category**: open|clustering|merged|dead-end`; optional `**Severity**:`), a one-sentence falsifiable hypothesis as the H1 title, a flat list of `file:line` evidence references with one-line notes, free-form `## Notes` (speculation welcome), `## Next` action list, `## Links` (cluster_with / merged_into / supersedes). Any session may append. Threads accumulate across runs.

Each thread is loaded by the existing `_load_markdown_reducer` machinery (`lineage/_extractor/src/lineage_extractor/graph_query/loaders.py`, registered with `id_prefix="SHB"`, `label=L_SHOEBOX="ShoeboxThread"`) into a `ReducerNodeRecord` whose body becomes the embedding target. Threads are **first-class nodes in the labeled-property-graph projection** and are picked up by `graph-search` semantic queries immediately. The maiden test: queries for `"data entity is stale predicate"` and `"compact lineage view toggle"` return SHB-001 and SHB-002 respectively as the top vector hit (cosine ≥ 0.75).

### 18.3 The four legal statuses (lifecycle)

| Status | Meaning | Transition out |
|---|---|---|
| `open` | New observation; ≤3 evidence refs; hypothesis tentative. | → `clustering` when evidence accumulates; → `dead-end` if disproved; → `merged` if discovered to be a facet of an existing F-NNN. |
| `clustering` | Multiple evidence refs spanning ≥2 substrate axes; hypothesis sharpening; may have cluster-siblings. | → `merged` when the maintainer graduates the thread to `feature-flows/detail/F-NNN.yaml` with `seeded_from: SHB-NNN`. |
| `merged` | Graduated to a feature flow. File kept for traceability (provenance: this feature was reverse-engineered FROM this thread). | Terminal. |
| `dead-end` | Investigation refuted the hypothesis (the observation belongs to no user-observable feature, or duplicates a closed thread). `## Notes` records why. | Terminal. |

A `dead-end` thread is **not** deleted — it is part of the methodology's audit trail.

### 18.4 Per-run shoebox evaluation (feature-flow-builder responsibility)

The `feature-flow-builder` agent (`.claude/agents/feature-flow-builder.md`) executes a mandatory **Step 0** at the start of every run, BEFORE composing new feature flows. It reads every `shoebox/detail/SHB-*.md` with `Category: open` or `clustering` and decides one of four verdicts per thread:

- **Graduate to feature** — evidence ≥3 refs spanning ≥2 substrate axes; hypothesis falsifiable; product surface clear. Authors `feature-flows/detail/F-NNN.yaml` with `seeded_from: SHB-NNN`; flips thread to `merged`.
- **Merge into existing feature** — hypothesis maps to a facet of an existing F-NNN. Appends evidence to that flow as `contributing_nodes` or `observed_vs_expected.facets`; flips thread to `merged` with `Links.merged_into: F-NNN`.
- **Cluster with siblings** — two-or-more `open` threads share keyword overlap in their hypothesis OR share ≥1 evidence file, AND together are still below the graduation threshold. Sets each thread's `Links.cluster_with` bidirectionally; flips each to `clustering`. Next run reconsiders the cluster as a single graduation candidate.
- **Leave as note** — insufficient evidence, ambiguous surface, competing candidates — defer. Appends an `## evaluation` entry: `feature-flow-builder YYYY-MM-DD: deferred — {reason; what would unblock}`. Status stays as-is.

The builder reports `graduated_count`, `merged_count`, `clustered_count`, `deferred_count` in `batch_refresh_note`. Multi-run convergence is the norm — a thread may stay `open` for several runs before crossing the graduation threshold. That is the point: hypotheses with thin evidence stay hypotheses until foraging catches up.

### 18.5 Who else writes shoebox threads

- **The `file-analyser` subagent (Rule 10).** When enriching one node, if a piece of the code's product purpose is not derivable from local context — a predicate utility imprinted by mappers off-chain; a UI control whose toggle target lives elsewhere — append a shoebox thread rather than forcing a sidecar conclusion. Cross-reference from the sidecar's `bugs_limitations_corner_cases` or `confidence_per_field` block back to the thread.
- **The maintainer**, during `/code-walk`, `/enrich`, or casual reading. Whenever a feature is noticed missing from `feature-flows/`, drop SHB-NNN with the initial observation.

The shoebox is NOT a backlog. Bugs go to `refactoring-scopes/` / `doc-gaps/` / `test-map/`; ADR-worthy decisions go to `implicit-adrs/`. The shoebox specifically captures *the kind of observation that names a feature you cannot yet anchor.*

### 18.6 What this layer subtracts

Per the 2026-05-26 design conversation: the alternative proposal — a DTO-field-decomposition reducer + cross-cutting-predicates substrate axis + per-mechanic requirement-reconstruction artefact + clustering composition reducer + new spot-check type + redefined coverage metric — is **withdrawn**. Reverse-engineering is note-taking + hypothesis-running, not richer composition. Adding more abstractions would have made the process *less* stable and *less* traceable.

The shoebox does the same work because hypotheses about DTO fields and lateral predicates are now legal artefacts in flight — they no longer need a special reducer to give them a home. The "anchored vs touched" correction happens naturally: as shoebox threads close into feature flows, real anchoring grows; threads that stay open are the honest gap. The 97.7%-effective vanity metric can stay or go — but the work list is `shoebox/detail/SHB-*.md` with `Category: open` or `clustering`, which is bounded, traceable, and aged by the dated `## evaluation` entries.

### 18.7 Bootstrapping a new project

Per APPROACH §6 ("How to apply this to your project"), the shoebox layer ports verbatim:

1. Create `lineage/{repo}/shoebox/README.md` and `shoebox/detail/`.
2. The graph_query loader registration is already in place (`config.L_SHOEBOX` + `_load_markdown_reducer(..., "shoebox", "SHB", ...)`); no per-project edit needed.
3. Add Rule 10 to your `file-analyser` agent contract and Step 0 to your `feature-flow-builder` agent contract. Both are universal — the contracts in this repo are copy-paste templates.
4. Seed the directory by hand-authoring 2-3 threads as worked examples during the methodology's first walk-through. The directory earns into use; no big-bang seeding required.

### Cross-references

- `lineage/{repo}/shoebox/README.md` — the per-repo contract + the schema + the lifecycle table.
- `lineage/{repo}/shoebox/detail/SHB-001-data-entity-staleness.md` — the worked example in `clustering` state.
- `lineage/{repo}/shoebox/detail/SHB-002-compact-lineage-view-mode.md` — the worked example in `open` state.
- `.claude/agents/file-analyser.md` — Rule 10 (append a shoebox thread when product purpose isn't local-derivable).
- `.claude/agents/feature-flow-builder.md` — Rule 8 + workflow Step 0 (per-run shoebox evaluation).
- `lineage/_extractor/src/lineage_extractor/graph_query/config.py` — `L_SHOEBOX = "ShoeboxThread"`.
- `lineage/_extractor/src/lineage_extractor/graph_query/loaders.py` — `_load_markdown_reducer(... "shoebox", "SHB", config.L_SHOEBOX)` registration.
- `retrospectives/LSN-023` — the `permission_side_door` mis-read; the shoebox is the corrective for that class of error.
- Pirolli & Card 2005; Von Mayrhauser & Vans 1995/96; Votipka et al. USENIX Security 2020 — the research grounding (full citations in `shoebox/README.md` §"Why this layer exists").

---

## 19. The Subject Matter Expert consultation pattern *(rev 11)*

### 19.1 Why this role exists — the missing domain anchor during composition

Layer 0 (`system-mission.md`, §13) supplies the project's static domain shape — pillars, audiences, architectural pillars. It runs ONCE per scan and produces an artefact. But composition runs every batch, and reflection runs every feature; both need a callable, on-demand consultation point for domain claims that are NOT captured in `system-mission.md` and that go beyond what the canonical concepts page covers:

- *"Is this hypothesis a plausible feature in the data-catalog domain, or am I forcing structure on noise?"*
- *"What does the industry call the concept this code embodies, and does our vocabulary align?"*
- *"What implicit functional / security / performance requirements does an operator of a system like this expect by default?"*
- *"How does {competitor system} behave for the equivalent feature, and does ODD's behaviour match operator expectations or surprise them?"*
- *"What operator workflow does this feature serve, and what other features does that workflow touch?"*

Without a place to ground answers to these, the file-analyser, feature-flow-builder, and feature-reflector each substitute pretrained domain knowledge for verified domain knowledge. That is the same failure shape as Rule 1 of the file-analyser (training-data ODD docs are forbidden; live URLs are mandatory). Domain claims about *what operators expect* are at least as drift-prone as documentation claims about *what the code does*.

The 2026-05-26 case-law named two concrete instances where this gap mattered:

- **Data Entity Staleness** (`SHB-001`) — the hypothesis "operators see a 'source has stopped publishing' indicator across every entity listing" is a domain claim. It is industry-standard (every published data catalog has freshness signals) but the current methodology has no consultation point to confirm that, name what operators expect (per-tenant thresholds? alerting integration? per-source overrides?), and align ODD's `is_stale` against how DataHub / Amundsen / OpenMetadata expose the same concept.
- **Compact lineage view-mode** (`SHB-002`) — the hypothesis "lineage views support a compact rendering for dense graphs" is a domain claim. Every modern lineage UI has this; without a consultation point, the feature-flow-builder can't ground "what should the compact mode actually do" in operator expectations.

### 19.2 What the SME is, what it is not

The SME is a project-specific subagent — **one per project** — invoked on-demand by other subagents or the maintainer. It is:

- **Interactive.** It runs per consultation question, not per scan.
- **Source-grounded.** It cites real URLs (the project's published docs, competitor systems' published pages) and workspace files. It NEVER cites pretraining knowledge.
- **Bounded.** ≤30 minutes per consultation; 2-5 WebFetches; one output note.
- **Advisory.** It produces a structured consultation note that the caller incorporates into its own artefact. It does not author finalized features, sidecars, or concepts.
- **Project-specific.** The SME for ODD knows about data-catalog systems; the SME for a Django payroll app would know about payroll-domain conventions; the SME for a Rust embedded controller would know about real-time systems and safety-critical patterns. The contract is universal; the knowledge anchors are per-project.

It is NOT:

- **A reducer.** It does not compose cross-sidecar truth.
- **An enricher.** It does not enrich one node end-to-end.
- **A backlog source.** Recommendations from a consultation go to the caller, which decides whether to file backlog. The SME does not file `REFACTOR-NNN` / `DOC-GAP-NNN` / `TEST-GAP-NNN` directly.
- **A replacement for the maintainer's senior PO lens.** The SME informs the lens with real domain evidence; the maintainer (and the feature-reflector) still does the judgment.

### 19.3 The universal contract (project-portable)

Every project's SME shares this contract:

| Block | What it carries |
|---|---|
| **Rule 0 — operating stance** | Senior product manager for the project's domain; ≥decade of operator experience; thinks in terms of operator workflows, not feature taxonomies. |
| **Rule 1 — live URLs only for domain claims** | The exact analogue of file-analyser Rule 1. Pretraining domain knowledge is forbidden. Every claim about industry behaviour, competitor systems, or operator expectations cites a live URL or a workspace file. |
| **Rule 2 — bounded scope** | One consultation question per invocation; ~30 minutes; 2-5 WebFetches; one output note. |
| **Rule 3 — anchor in project-specific positioning** | The SME references the project's `system-mission.md` for pillars, audiences, architectural pillars. Comparisons against competitors anchor on *specific pillar* differences, not vague "feature coverage." |
| **Rule 4 — operator workflows are the unit of judgment** | A feature hypothesis is plausible if it maps to a recognizable operator workflow. The SME's contract enumerates the project-specific operator workflow seed set. |
| **Rule 5 — output shape** | One file per invocation: `lineage/{repo}/sme-consultations/YYYY-MM-DD-{slug}.md` with frontmatter + sections (TL;DR / Question scope / Domain plausibility / Industry vocabulary alignment / Implicit requirements / Operator workflows / Competitor comparison / Recommended framing / Caveats / Citations). |
| **Rule 6 — explicit uncertainty** | A consultation that confesses `confidence: LOW` and names what would unblock is more useful than one that fabricates confidence. The caller treats LOW-confidence consultations as informative-not-load-bearing. |

The project-specific bits each SME authors:

1. **Domain identity** — what kind of platform this is (data catalog / payroll / observability / embedded controller / etc.)
2. **Operator workflow seed set** — 5-10 concrete workflows operators run (per role + trigger + expected outcome)
3. **Canonical competitor list** — 4-8 named reference systems with authoritative URLs, ranked by relevance to consultation questions
4. **Allowed pretraining knowledge boundary** — explicitly named topics where pretraining is the only source (e.g. abstract industry vocabulary that has no canonical URL — flagged `confidence: LOW`)

### 19.4 Integration into the existing pipeline

The SME consultation is woven into three existing subagent contracts:

- **`file-analyser` Rule 10 extension** — when local context does not explain product purpose AND the observation is shoebox-eligible (per §18), the file-analyser may consult the SME to check whether the hypothesis fits a known domain pattern. If yes, that's stronger than a `guess:` note — the SME's framing goes into the shoebox thread's `## Notes` block as a citation. If no, the thread stays open with `domain_unverified: true`.
- **`feature-flow-builder` Step 0 extension** — during the per-run shoebox evaluation (§18.4), for each thread in `clustering` state the builder MAY (not MUST) spawn the SME to validate the hypothesis against domain expectations and surface implicit requirements before deciding graduate / merge / cluster / defer. SME consultation is mandatory for `graduate` and `merge` verdicts when the feature's pillar mapping is ambiguous.
- **`feature-reflector`** — when generating user-facing hypotheses for a composed flow (§15), the reflector consults the SME for industry-vocabulary alignment and for the canonical operator workflow this feature participates in. SME consultation strengthens reflection hypotheses with domain citations.

The maintainer may invoke the SME directly (via `Agent` with `subagent_type: {project}-sme`) for ad-hoc consultations during `/code-walk` or planning sessions.

### 19.5 Output discipline — consultation notes are flat reference material

Consultation notes live at `lineage/{repo}/sme-consultations/YYYY-MM-DD-{slug}.md`. They are:

- **Dated and citable** — each note carries `consulted_at`, `consulted_by`, `consultation_question`, `confidence_overall`.
- **Bounded** — typically 400-1200 words. A note longer than 1200 → either split or overrunning.
- **Cross-referenced** — the caller's artefact (shoebox thread / feature flow / feature reflection) adds a one-line reference back to the consultation slug. The consultation's frontmatter names the caller.
- **Re-runnable** — if a consultation is >30 days old and the question is re-raised, the caller spawns a fresh consultation rather than reusing the stale note. Domain knowledge ages.
- **NOT in the graph (initially)** — consultations are kept as flat reference material. If a future review shows semantic search would help, the loader registration is one line away (per the shoebox pattern). Until then, grep + recency-aware reading is enough.

### 19.6 Bootstrapping a new project's SME

Per APPROACH §6 ("How to apply this to your project"), the SME consultation pattern ports verbatim:

1. Copy `.claude/agents/odd-sme.md` to `.claude/agents/{your-project}-sme.md` and rewrite three blocks:
   - The frontmatter `name`, `description` for your project's domain.
   - Rule 4's operator-workflow seed set — your project's concrete workflows.
   - Rule 3's competitor / reference list — your domain's authoritative URLs.
2. Create `lineage/{your-repo}/sme-consultations/` with a README naming the directory's purpose.
3. Add Rule 10 (consult SME path) to your `file-analyser` agent contract; add the Step-0 hook to your `feature-flow-builder`; add the vocabulary-alignment hook to your `feature-reflector`.
4. Seed the first 2-3 consultations during your initial feature batch as worked examples — the directory earns into use; no big-bang seeding required.

### 19.7 What this layer does NOT add

Per the 2026-05-26 conversation guidance ("methodology should subtract"; "minimal resources, maximum value"), the SME layer is intentionally minimal:

- **No new reducer.** It does not produce a cross-sidecar artefact.
- **No new substrate axis.** It does not change the node kinds the extractor harvests.
- **No new graph label initially.** Consultation notes are flat reference material; if semantic search proves valuable, registration is one line.
- **No new metric.** The SME does not introduce a coverage metric or a scoring axis. Its output is advisory.

The SME is one new subagent + one new directory + a Rule-10/Step-0/vocab-hook extension to three existing contracts. That is the entire footprint.

### Cross-references

- `.claude/agents/odd-sme.md` — the concrete ODD-domain SME (the worked instance of this universal pattern).
- `.claude/agents/file-analyser.md` — Rule 10 (shoebox path + optional SME consultation when domain pattern is recognizable).
- `.claude/agents/feature-flow-builder.md` — Step 0 + Rule 8 (SME consultation during shoebox evaluation; mandatory for graduate/merge with ambiguous pillar mapping).
- `.claude/agents/feature-reflector.md` — SME consultation for industry-vocabulary alignment and operator-workflow grounding in user-facing hypotheses.
- `.claude/agents/domain-extractor.md` — your sibling that produced `system-mission.md`; the SME is its on-demand interactive counterpart.
- `lineage/{repo}/system-mission.md` — Layer 0's static output; the SME's primary internal source.
- `lineage/{repo}/sme-consultations/` — the SME's output directory (one consultation per file, dated).

---

## 20. Scanner ↔ ontology fusion *(rev 13)*

### 20.1 Why this section exists

The methodology grew two complementary but unconnected pipelines:

- **The scanner pipeline** (pre-ontology, "production"): `scanners/{category}/*.md` → `/scan` → `findings/` → `/triage` → `backlog/` + `issues/`. Breadth-first; doc-as-requirements-registry; reads the `documentation/` repo + a small set of code entry-points to surface gaps. Strong at *enumerating from documentation*; weak at *implementation depth*.
- **The ontology pipeline** (rev 1-12, "deep"): substrate → sidecars → reducers → `feature-flows/` + `concepts.yaml` + `doc-gaps.md` + `shoebox/`. Depth-first; code-as-truth; semantically-anchored graph. Strong at *implementation-anchored claims*; weak at *intent generalization* (current LLM capabilities cannot reliably infer "what feature is this code implementing" from bottom-up code-walks — the PO + SME + shoebox layers compensate but the gap remains).

The two ran in parallel with **no formal interface**. The scanner was blind to the ontology's 113 feature-flows; the ontology was blind to the scanner's 165 backlog items. **726 ontology-surfaced candidate findings** (103 doc-gaps + 211 refactoring-scopes + 312 test-gaps) sat unreachable by `/triage`. The maintainer was the manual broker.

Rev 13 closes this with a small, locked-shape fusion: scanners gain a mode-B ontology-fed run; ontology artefacts gain annotate-only write-back from scanners. **The ontology IS the precomputed answer key the scanner has been re-deriving by hand.**

### 20.2 The two-mode scanner protocol

Every scanner can run in one of two modes per scan-run (mode-locked at start; never switched mid-run):

- **Mode A — standalone.** Existing behaviour, unchanged. Backward-compatible. Every existing scanner and every existing finding remains valid. Default for any scanner without an `ontology_feed:` frontmatter block.
- **Mode B — ontology-fed.** Opt-in via `ontology_feed.enabled: true` in the scanner's frontmatter. The scanner iterates `lineage/{repo}/feature-flows/detail/F-*.yaml` as its primary investigation target (per the per-feature pseudo-protocol below), consumes `doc-gaps.md` / `concepts.yaml` / `shoebox/` as secondary clues, and writes back annotate-only frontmatter to the artefacts it consulted.

### 20.3 Mode B — the per-feature investigation protocol

For every in-scope F-NNN (filtered per scanner's declared scope):

1. **Read the feature flow.** `feature-flows/detail/F-{NNN}.yaml` — extract `feature_name`, `pillar_id`, `pillar_anchored_feature_name`, `description`, `contributing_nodes[]`, `chain[].evidence`, `observed_vs_expected.facets[]`, `status`.
2. **Derive expected doc location.** From `pillar_id` + `pillar_anchored_feature_name` + `system-mission.md`'s pillar mapping. Check whether the page exists under `documentation/docs/`.
3. **Verify against code (the ladder, per clue class):**
   - `file_exists` — Read the cited file ±5 lines.
   - `assertion_about_code` — Read the cited region + verify mechanically (regex / direct match).
   - `cross_layer_behaviour` — Run the cited probe if `probe_verifications:` populated; else file a `probe-needed` finding.
   - `doc_drift` — Fresh `WebFetch` of the expected doc URL; compare against the feature's `description` field (description-as-clue verification).
4. **Emit findings:**
   - `missing-page` if the doc doesn't exist.
   - `drift` if description and live doc diverge.
   - `missing-caveat` per `observed_vs_expected.facets[]` entry not mentioned in doc.
   - `ontology-drift` per hop whose `evidence` line moved or vanished.
5. **Write back** a `scanner_reviews:` entry to F-NNN with `doc_status: backlog | drafted | reviewed | live | invalidated`, `ontology_corroborated: true | false | partial`, `scanner_finding_ids: [F-NNN, ...]`, `ontology_commit_consulted: <sha>`.
6. **Dedup lookup** against `lineage/{repo}/doc-gaps.md` — if a matching `DOC-GAP-NNN` exists, write a `corroborated_by_scanner:` block to its detail file. Do NOT emit a duplicate finding.
7. **Per-scan-run consultation budget:** at most 3 `feature-reflector` (PO) consults, 2 `odd-sme` consults, 5 `graph-retriever` invocations. Excess → backlog escalation, not silent drop.

### 20.4 Roles and read-priority of the ontology artefacts

| Artefact | Role | Why |
|---|---|---|
| `feature-flows/detail/F-*.yaml` | **PRIMARY investigation target** | The catalog of every feature with `description` (operator language), `chain` (code anchors), `observed_vs_expected.facets` (drift signals). Source-richer than doc-gaps; updated by `feature-flow-builder` on each batch. |
| `concepts.yaml` | Canonical vocabulary anchor | Detects non-canonical terms in docs; alias/synonym drift surfacing. |
| `shoebox/detail/SHB-*.md` | Hypothesis verification opportunity | Open / clustering threads name hypotheses the scanner can opportunistically verify and append `## evaluation` to. |
| `doc-gaps.md` | **DEDUP/PRIORITY HINT ONLY** — never a coverage signal | Reducer output; can have its own gaps (B9). A feature absent from doc-gaps.md is NOT presumed documented. Used only at the dedup step (6 above). |
| graph-query primitives (`graph-search` / `graph-node` / `graph-neighbours`) | Ad-hoc semantic discovery | Beyond the scanner's enumerated axes when needed; capped at 5 invocations per scan-run. |

### 20.5 The write-back contract — annotate-only

Scanner writes ONE block shape to feature-flows, sidecars, and doc-gaps:

```yaml
scanner_reviews:                          # APPEND-ONLY list
- scan_id: docs-accuracy-feature-behavior/2026-05-27-batch-A
  reviewed_at: 2026-05-27T14:32:00Z
  reviewer_scanner: docs/accuracy/feature-behavior
  ontology_commit_consulted: ede5d277
  doc_status: backlog                     # backlog | drafted | reviewed | live | invalidated
  scanner_finding_ids: [F-001, F-007]
  doc_pages_touched: ["docs/features/active-platform-features/alerting.md"]
  ontology_corroborated: true             # true | false | partial
  notes: |- ...
  maintainer_curated: false               # set true after maintainer edits; never auto-overwritten
```

Idempotency key: `(scanner_id, scan_run_date)`. Append-only: same-key re-runs upsert; different-key entries coexist. Maintainer-curated entries (`maintainer_curated: true`) are never auto-overwritten. **Substrate / reducer-produced content is never mutated.** The reducers (`feature-flow-builder`, `concept-merger`, `doc-gap-finder`, `adr-archaeologist`, `test-coverage-mapper`) remain the sole writers of feature semantics; the scanner is a status annotator.

A per-scan-run reproducibility log lands at `lineage/{repo}/scanner-feed/{date}-{scan_run_id}.yaml` (always emitted; absence is informative). Triage consumes it to lift priority on ontology-corroborated findings.

### 20.6 Conflict resolution

When the scanner and the ontology disagree:

- **Scanner thinks feature is undocumented; ontology has `documents:` populated.** Scanner runs fresh `WebFetch`. Live page covers the claim → defer to ontology, no finding. Live page 404s or omits the claim → file undocumented finding AND write `doc_status: invalidated` on the ontology's claim.
- **Scanner finds drift; `feature-reflector` flagged the same drift with different severity.** Emit an enrichment entry (per `scanners/README.md` "Deduplication") citing both severities; maintainer adjudicates at triage. No automatic override.
- **Maintainer manually edited `scanner_reviews:`.** Append-only writeback — scanner never edits maintainer-marked entries (`maintainer_curated: true`); the maintainer's `doc_status:` of the most recent entry wins.

Per Glean's published dual-source posture (PITFALLS C3): when sources disagree, cite BOTH with explicit provenance and route to maintainer review. Default is NOT "code wins, file a doc-gap" — it is "two sources disagree, here are both, you decide."

### 20.7 Agent escalation — PO and SME consultations

The scanner spawns `feature-reflector` (PO consult; cap 3/run) when:
- A feature-flow's product framing (`feature_name` + `description` + pillar) disagrees with the assembled chain, AND the scanner cannot independently judge which side is right.

The scanner spawns `odd-sme` (domain consult; cap 2/run) when:
- The pillar-mapping or industry-vocabulary alignment for a feature is ambiguous (e.g. ODD names a capability one way; comparable systems name it another; the scanner alone cannot judge whether it's a deliberate divergence or an under-documented alias).

Excess triggers → backlog escalation entry (`escalation: pending-sme-review`), never silent drop. Routing through the existing rev-11 SME pattern (`lineage/{repo}/sme-consultations/{date}-{slug}.md`) is non-negotiable; inventing a parallel channel splits the audit trail.

### 20.8 The 13 hard rules (Rule 21 condensation)

Rule 21 (added below in section 5) condenses the 13 rules from `adrs/drafts/research/scanner-ontology-fusion/PITFALLS.md` (D1-D13) into one workspace-level invariant: **every mode-B scanner emission must stamp `ontology_commit_consulted:`, cite a written target, run a self-contained verification, distinguish `ontology-confirmed` from `ontology-extended`, dedup against the four reducer registries, abort on insufficient coverage, respect the per-run consultation budget, and iterate the feature catalog as primary investigation (not corroborate doc-gaps as exhaustive)**. Full rule text and per-rule pitfall mapping at `adrs/drafts/research/scanner-ontology-fusion/PITFALLS.md`.

### 20.9 Pilot scanners and transition path

- **Day 1 — 2 pilots:** `docs/coverage/undocumented-features` (already enumerates from code; cheapest fit) + `docs/accuracy/feature-behavior` (canonical accuracy scanner; highest-value fit). One week pilot per scanner.
- **Day 30 — broad rollout:** ~18 of 28 scanners flip to `ontology_feed.enabled: true`. Pure URL/HTML scanners (`docs/quality/rendering`, `docs/quality/outbound-urls`) and test/spec scanners stay standalone forever (different domain or circular feedback risk).
- **Day 90 — `doc-gap-finder` restructure decision.** Formally deferred. If pilots show ≥60% overlap between scanner-emitted gaps and doc-gap-finder output, restructure becomes interesting. If <30%, the reducer keeps its independent cadence.

### 20.10 What this rev is NOT — explicit out-of-scope

- NO substrate mutation outside `scanner_reviews:` blocks.
- NO changes to reducers (`feature-flow-builder`, `concept-merger`, `adr-archaeologist`, `test-coverage-mapper`, `doc-gap-finder`). Fusion is scanner-side only.
- NO new orchestrator skill — `/scan` grows ~80 lines; no split.
- NO Source-of-Truth class supersession — `Ontology` is additive, always co-cited with the underlying primary-source class (`Ontology[F-001:hop-1] → Repo[DataEntityDetails.tsx:56-64]`).
- NO auto-promotion of reducer outputs (`refactoring-scopes.md` 211 entries, `test-map.yaml` 312 entries) to backlog. Promotion stays maintainer-in-the-loop.
- NO subsumption of `doc-gap-finder` into the scanner (rev-14 question, deferred).
- NO ontology-fed mode for spec scanners or test scanners (circular feedback risk).

### 20.11 Cross-references

- `adrs/drafts/research/scanner-ontology-fusion/SUMMARY.md` — opinionated synthesis, the design's rationale anchor.
- `adrs/drafts/research/scanner-ontology-fusion/{STATE,GAPS,DESIGN-CHOICES,PITFALLS,INTEROP}.md` — the 5 supporting research threads.
- `scanners/README.md` — extended with the `ontology_feed:` block schema + two-mode contract.
- `.claude/skills/scan/SKILL.md` — extended with the conditional branch for mode B.
- `.claude/skills/triage/SKILL.md` — extended to ingest `scanner-feed/` logs and lift priority on ontology-corroborated findings.
- Trigger: maintainer-identified gap on 2026-05-27 — the two pipelines have been complementary but parallel since rev 1; the maintainer was the manual broker. **The maintainer-applied refinement** ("feature-flows is primary; doc-gaps not exhaustive") is baked into PITFALLS rule D13 and INTEROP §1.0.
