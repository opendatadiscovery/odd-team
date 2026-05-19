---
id: ADR-DRAFT-dynamic-verification-layer
title: "Add a local-only dynamic-verification layer that runs probes against an ephemeral writable mirror, captures empirical observations, and feeds measured truth back into the static ontology layers — converting inferred claims into measured ones"
status: draft
date: 2026-05-19
scope: workspace-meta (EXTENDS `feature-anchored-ontology.md` revision 1 + `agentic-code-ontology.md` revision 3 + `code-lineage-substrate.md` revision 3 — does not supersede)
related_drafts: ADR-DRAFT-feature-anchored-ontology, ADR-DRAFT-agentic-code-ontology, ADR-DRAFT-code-lineage-substrate
trigger_incident: 2026-05-19 maintainer question — "what is the impact on robustness and efficiency if we have access to a system copy we can update?" Combined with LSN-017 (per-node scan cannot see cross-layer user effects): the static ontology produces inferred truth; cross-layer composition compounds inference, and inference compounded across N hops accumulates uncertainty that no static layer can resolve.
case_law: retrospectives/LSN-017-per-node-scan-cannot-see-cross-layer-user-effects.md (the trigger — view_count doubling miss + the methodology conversation that followed)
operational_invariant: LOCAL-ONLY — every probe component runs on the maintainer's workstation; no remote / cloud infrastructure. Per APPROACH.md section 5 rule 12 + section 9. The constraint is operationally load-bearing for an unfunded OSS project.
methodology_principle_introduced: "inferred truth is provisional; measured truth is canonical. Where static inference and dynamic measurement disagree, measurement wins; the static layer's confidence drops to LOW and a re-enrichment is queued."
---

# ADR-DRAFT: Dynamic-Verification Layer (layer 5 — local-only writable mirror + probe runner + measured truth)

## Context

### The trigger

After the rev-2 methodology shift shipped (`feature-anchored-ontology.md` + `APPROACH.md` rev 2 + `file-analyser.md` v0.3.0 + new `feature-flow-builder.md` reducer) and LSN-017 captured the view_count doubling miss as case-law, the maintainer asked:

> *could we also assess in the context of the solution we build what will be the impact of the robustness and efficiency if we have an access to the system that we describe and research? Especially, a copy of the system that we could update (add data, modify)?*

The question identifies a structural ceiling on the rev-2 work. The static ontology — substrate + per-node sidecars + cross-file reducers + feature-flow-builder — produces **inferred truth** at every layer. A sidecar concludes "+1 view_count per call" by reading `incrementViewCount(id)` inside `@ReactiveTransactional`. That conclusion is sound under static assumptions: the annotation fires; the transaction commits; no override exists elsewhere. But the conclusion is **never measured** against a running system.

Cross-layer composition compounds the problem. Feature-flow-builder produces an `amplification_factor` as a product of `multiplicity_per_trigger` across a chain — a 4-hop chain is the product of 4 separate static interpretations. Inference compounds. LSN-017 is the canonical failure shape: backend inferred correctly (+1), UI inferred correctly (×2 via useEffect dep-array), but the product (+2 per user-visible page-open) was never computed because *no one ran the system*. The feature-flow-builder ADR proposed the right composition; this ADR proposes its empirical verification.

Critically, the maintainer subsequently constrained the operational envelope:

> *we could use only local station. And we should document it: run components locally only - no additional costs should be generated.*

This is documented in APPROACH.md section 5 rule 12 and section 9. The dynamic-verification layer inherits the constraint as its load-bearing operational invariant.

### Why this is an architectural decision, not a tactical pivot

Three independent considerations make this a genuine architectural decision rather than "just add some probes":

1. **The methodology gains a new epistemic principle.** Today every claim in every layer is inferred from code-reading. Adding dynamic verification introduces a category of claim — **measured truth** — that is qualitatively different (it has empirical referents). The ontology must declare which claims are inferred vs measured, which graph cell is verified-by-probe vs verified-by-static-analysis, and what happens when the two disagree. This is a load-bearing distinction that compounds across all four existing layers; it cannot be retrofitted opportunistically.

2. **It introduces an executable component into a previously purely-declarative methodology.** Layers 1-4 read code, write artefacts, never execute the system under analysis. Layer 5 *executes* the system via `docker-compose up`, `curl`, `psql`, `playwright`. This is a new capability class for the subagent runtime — a subagent with `Bash` permissions running probes is qualitatively different from the read-only enrichers and reducers. The orchestration shape, tool surface, safety rules, and artefact lifecycle all differ from the existing layers.

3. **It binds the methodology to a local runtime, but only locally.** The local-only constraint inherited from APPROACH.md is not a soft preference — it shapes every implementation choice (ephemeral docker-compose vs persistent VM; Testcontainers vs RDS; Playwright local Chromium vs hosted browser farm; k6 CLI vs managed load service). A future revision that proposed remote infrastructure would constitute a new architectural decision; this ADR forecloses that path while leaving the local capability open.

The right response is **extension**. Layers 1-4 stay valid; layer 5 is additive and feeds measurements back into layers 4 (feature-flow-builder) and 3 (test-coverage-mapper, doc-gap-finder) via well-defined artefacts. The existing rev-2 ADR (`feature-anchored-ontology.md`) is the natural anchor; this ADR extends it.

### What this layer buys (and what it does NOT)

| Buys | Does not buy |
|---|---|
| **Empirical ground-truth for every probe-able claim.** "+1 per call" stops being inferred and becomes measured. The view_count doubling case ships with a passing probe pinning the buggy +2 behaviour; future fix flips the probe to assert +1. | **Replacement of any static layer.** Substrate + sidecars + cross-file reducers + feature-flow-builder remain primary. Layer 5 verifies; it does not derive feature catalogs from runtime behaviour. |
| **Performance / concurrency / time-dependent / security-adversarial findings become measurable.** "No view_count index" can be promoted to "p99 = 230ms at 50K entities measured 2026-05-NN." "DISABLED-mode bypass" can be promoted to "verified anonymous reachability on 17 endpoints, observed in run R-NNN." | **Eliminating false positives in the static layers.** A sidecar's claim that has no probe yet still stands as inferred truth. The methodology grows probe coverage incrementally; static is the floor, dynamic is the ceiling on confidence. |
| **Cross-layer composition becomes observed, not assumed.** The full chain (UI mount → thunk → API → service → repository → DB) can be measured end-to-end with one probe; the amplification_factor lands in feature-flows.yaml with `source: measured`, not `source: inferred`. | **Replacement of the test suite.** Probes are not unit tests in CI; they are short-lived regression-pins or behaviour-validations run on demand. The 4-class test matrix still wants tests in the codebase; probes accelerate the validation but do not displace the build pipeline. |
| **Doc-as-product alignment becomes quantitative.** Drift between doc claims and system behaviour gains numeric measurement (latency p99, count, status code, response shape) rather than textual mismatch. The maintainer's "0% code↔doc gap" ambition gains a measurable target. | **Reproducibility without discipline.** Ephemeral mirrors require explicit version pinning (substrate commit + docker-compose tag + probe definition version). Without that pinning, today's measurement and tomorrow's measurement may disagree for reasons that are not the system's behaviour drift. The ADR makes the pinning mandatory. |
| **Multiple reducer outputs populated by single observation.** One probe-run feeds: feature-flow-builder's observed_vs_expected; test-coverage-mapper's per-feature matrix cell; doc-gap-finder's feature-control-gap quantitative wording; concept-merger's per-concept performance aggregate. High amortisation factor across the ontology. | **Free operation.** Mirror provisioning consumes workstation resources (CPU, RAM, disk for the docker stack). A probe round consumes minutes-to-tens-of-minutes of maintainer machine time. Within the local-only envelope this is the only "cost" — but it is a real one. |

### Why now, not later

The rev-2 ADR explicitly anticipated layer 5. Its slice-5 (Type-7 probe set seed) was left deferred precisely so this ADR could land first with a coherent design. Three reasons to draft now rather than defer further:

1. **The rev-2 feature-flow-builder has empty cells that probes are designed to fill.** `observed_vs_expected.observed` is populated from sidecar inference today; the contract is that probes will eventually supersede with measurement. Without an ADR specifying the probe layer, that supersession mechanism is undefined and feature-flows.yaml carries a permanent "TODO: verify" annotation on every feature.

2. **LSN-017 has a forcing question** that demands an executable answer: *for this code I'm enriching, what is the user-observable behaviour that depends on it, and from which entry points is that behaviour triggered? What is the cardinality of those triggers?* The static layers can articulate the question; only the dynamic layer can verify the answer.

3. **The local-only constraint just landed in APPROACH.md** + the file-analyser + feature-flow-builder. The dynamic-verification layer is the first capability that materially depends on that constraint. Drafting now means the constraint is anchored at the point of use; later drafts risk drifting toward "well, just this one part needs remote..."

## Decision

**Add a layer-5 dynamic-verification capability. Each probe round provisions an ephemeral local docker-compose mirror of the system under analysis, runs declarative probes against it (arrange / act / observe / assert / cleanup), captures observation traces as committed artefacts, and feeds measured-truth annotations back into the static layers' artefacts. The capability runs entirely on the maintainer's workstation. Where measurement disagrees with static inference, measurement wins; the static layer downgrades its confidence and queues re-enrichment.**

### The five capabilities

| Capability | What it does | Where it runs |
|---|---|---|
| **1. Mirror provisioning** | `docker-compose up` an ephemeral writable stack of the system under analysis (Postgres + Spring Boot + UI + minimal collectors for ODD; equivalent for other stacks). Seed minimal fixtures. | Maintainer workstation, local Docker daemon |
| **2. Probe definition** | Declarative YAML files at `lineage/{repo}/probes/{probe_id}.yaml` — one probe per file. Each carries `arrange / act / observe / assert / cleanup` blocks + cross-references to feature_id / test_class / verified_against_commit. Maintainer-authored; future skill can generate skeletons from feature-flows.yaml. | Filesystem only |
| **3. Probe execution** | `probe-runner` subagent walks the probe definition, executes arrange steps (DB inserts, REST calls, config flips), runs act steps, captures observations, evaluates assertions, runs cleanup. Records every step's outcome with timestamps + evidence. | Maintainer workstation; subagent has `Bash` tool to run docker / curl / psql / playwright |
| **4. Observation capture** | Each probe round produces one artefact at `lineage/{repo}/probe-runs/{date}-{probe_id}.yaml` carrying: invocation context, arrange outcomes, act outcomes, observed values (DB deltas, response payloads, latency samples, log excerpts, metric values), assertion results, cleanup outcomes. | Filesystem only |
| **5. Feedback into static layers** | After a probe round, the reducer artefacts `feature-flows.yaml` and `test-map.yaml` are updated: feature_flow's `observed_vs_expected.observed` becomes `"<value> (measured run-R-NNN)"`; test-matrix cell flips to `PROBED` with citation to the probe-run; sidecars whose claims are now empirically verified gain `confidence: VERIFIED-VIA-PROBE-RUN-NNN` annotation. Where measurement disagrees with inference, sidecar confidence drops to LOW with a `superseded_by: probe-run-NNN` reference, and re-enrichment is queued. | Orchestrator-side merging (same shape as feature-flow-builder's incremental mode) |

### Non-negotiable rules

1. **Local-only execution.** Per APPROACH.md section 5 rule 12 + section 9. No remote VMs, no managed databases, no cloud-CI runners as part of the probe loop, no hosted observability backends. Open-source local tooling only: docker-compose / podman-compose, Testcontainers, Playwright / Puppeteer, k6 / wrk, WireMock / MockServer. The maintainer's workstation is the entire infrastructure.

2. **Ephemeral state by default.** Each probe round provisions a fresh stack from a known image + seed, runs probes against it, and tears down (`docker-compose down -v` — volume destroyed). Persistent local stacks are allowed for ad-hoc maintainer exploration but never for canonical probe-run artefacts. The reproducibility contract is: same substrate commit + same probe version + same docker-compose tag → same observation (within noise tolerance).

3. **Inferred truth is provisional; measured truth is canonical.** When static inference and dynamic measurement disagree, measurement wins. The sidecar's confidence drops to LOW; a `superseded_by: probe-run-NNN` annotation is added; re-enrichment is queued. The static layer learns from the dynamic layer over time; the two converge as probe coverage grows.

4. **Probe scope is declared on write, not inferred at runtime.** Each probe definition carries the explicit list of system components it touches and the explicit set of side effects it produces during `arrange` (DB writes, config flips, file system mutations). The runner refuses to execute probes whose declared scope is incomplete relative to their actual operations (detected via dry-run inspection of the probe's act/arrange steps). This prevents accidental cross-probe interference and enables reasoning about probe isolation when running multiple in one round.

5. **Probes are versioned alongside the substrate.** Each probe carries `verified_against_commit: <sha>` matching the substrate's `last_scan_commit`. A probe whose `verified_against_commit` lags the current substrate by a configurable threshold (default: 5 commits) surfaces as a *probe-staleness finding* in the probe-runner's output. The reducer artefacts treat measurements from stale probes with reduced confidence.

6. **No source code modification by probe-runner.** The probe-runner subagent has `Read, Glob, Grep, Bash, Write` — but `Write` goes only to `lineage/{repo}/probe-runs/{date}-{probe_id}.yaml` and to in-mirror state (DB rows, config files in the ephemeral container, *NOT* the substrate's source repo). The system-under-analysis source code is read-only; mutations happen inside the ephemeral mirror only.

7. **No probe targets production-shaped credentials, secrets, or external services.** Probes interact with the local mirror's mocked external services (WireMock for Slack, MockServer for OAuth providers, local Postgres for DB) only. Live external systems (`demo.oddp.io`, real Slack workspaces, real OAuth providers) are never probe targets. The local-only constraint extends to dependency surfaces — probes are hermetic against the maintainer's local machine.

### Schema additions

#### Probe definition shape (one YAML file per probe)

Stored at `lineage/{repo}/probes/{probe_id}.yaml`:

```yaml
---
probe_id: P-NNN
feature_id: F-NNN          # cross-reference to feature-flows.yaml
test_class: unit | integration | performance | security
verified_against_commit: <substrate last_scan_commit>
prompt_version: probe-runner/0.1.0
maintainer_curated: true | false
expected_outcome: |
  One sentence — what should be observed (the invariant the probe verifies).
  Phrased as a user-observable statement, not a code-level statement.
---

# Optional descriptive prose for the maintainer; ignored by the runner.

stack_profile: minimal | with-collectors | with-ui | with-ingestion-filter
  # named docker-compose profile to bring up; defined in lineage/_extractor/probe-stacks/

arrange:
  - kind: docker-compose-up
    profile: <stack_profile>
    seed:
      - sql: "INSERT INTO data_entity (id, oddrn, ...) VALUES (...)"
      - rest:
          method: POST
          path: /api/owners
          body: { name: "test-owner" }
          auth: admin-policy
      - config_override:
          key: auth.type
          value: LOGIN_FORM
  - timeout_seconds: 60     # arrange-step hard budget

act:
  - kind: rest
    method: GET
    path: /api/dataentities/${entity_id}
    auth: user-policy
    count: 5                 # how many times to repeat the act step
    inter_step_pause_ms: 50  # for ordering / observability

observe:
  - kind: sql
    query: "SELECT view_count FROM data_entity WHERE id = ${entity_id}"
    capture_as: final_view_count
  - kind: response_field
    last_act_step: 5         # which act step (0-indexed) to read
    json_path: $.id
    capture_as: returned_id
  - kind: latency_distribution
    over: "all act steps"
    capture_percentiles: [p50, p95, p99]
    capture_as: latency_curve
  - kind: log_grep
    container: backend
    pattern: "view_count incremented"
    capture_as: log_count

assert:
  - "final_view_count - initial_view_count == 5"   # current expected if +1 per call
  # OR for regression-pin:
  - "final_view_count - initial_view_count == 10"  # current actual if UI page-open via browser × 5 mounts; documents the bug

cleanup:
  - kind: docker-compose-down
    destroy_volumes: true

cross_references:
  refactoring_scopes: [REFACTOR-201, REFACTOR-220]
  test_gaps: [TEST-GAP-256, TEST-GAP-309]
  doc_gaps: [DOC-GAP-085, DOC-GAP-101]
  related_concepts: ["Popular Entities Ranking"]
```

Probe definitions are committed to the repo (versioned). The probe corpus grows incrementally; each batch should add 2-5 probes.

#### Probe-run artefact shape (one YAML per probe execution)

Stored at `lineage/{repo}/probe-runs/{ISO-date}-{probe_id}.yaml`:

```yaml
---
probe_run_id: R-NNN
probe_id: P-NNN
ran_at: <ISO timestamp>
ran_against_substrate_commit: <sha>
ran_against_docker_compose_tag: <semver or commit>
maintainer: <git config user.name>
total_duration_ms: <int>
outcome: PASS | FAIL | ERROR | TIMEOUT
verdict_reason: |
  One paragraph — what was observed vs what was asserted.
artefacts_updated:
  - feature-flows.yaml:F-NNN.observed_vs_expected.observed
  - test-map.yaml:per_feature.F-NNN.test_matrix.<test_class>
  - <sidecar slug>.md confidence_per_field downgrades
---

arrange_outcomes:
  - kind: docker-compose-up
    duration_ms: 42_300
    outcome: success
    log_excerpt: |
      <stderr/stdout from up>
  - kind: sql
    query: "INSERT INTO data_entity ..."
    duration_ms: 8
    outcome: success
    rows_affected: 1
  - ...

act_outcomes:
  - step: 0
    request: { method: GET, path: /api/dataentities/123 }
    response_status: 200
    response_size_bytes: 2145
    duration_ms: 32
  - step: 1
    ...

observe_outcomes:
  - final_view_count: 105
  - returned_id: 123
  - latency_curve:
      p50: 28
      p95: 64
      p99: 95
  - log_count: 5

assert_outcomes:
  - "final_view_count - initial_view_count == 5": false
  - "final_view_count - initial_view_count == 10": true

cleanup_outcome:
  - kind: docker-compose-down
    destroy_volumes: true
    outcome: success
    duration_ms: 4_200

raw_logs_path: lineage/{repo}/probe-runs/{date}-{probe_id}.logs.tar.gz
  # optional; compressed bundle of container logs + DB snapshots, only when outcome != PASS
```

#### Cross-layer artefact updates

After a probe run, the orchestrator merges measured values into the static artefacts. Three update patterns:

1. **feature-flows.yaml** — `observed_vs_expected.observed` gets `"<value> (measured run R-NNN at <iso>)"`; `amplification_factor` gets `<value> (measured)` flag; the `provenance` field flips from `inferred` to `measured`. Sidecar references in the feature entry are unchanged.

2. **test-map.yaml** — per-feature matrix cell state flips:
   - `GAP` → `PROBED-PASSING` (if probe asserts current behaviour as correct)
   - `GAP` → `PROBED-PINNING-BUG` (if probe pins a known-buggy behaviour for regression)
   - `PARTIAL` → `PROBED-COMPLETED` (probe covers the previously-uncovered behaviours)
   - `COVERED` stays `COVERED` unless probe contradicts the test result, in which case → `PROBE-TEST-DISAGREEMENT` (an alarming class that demands maintainer review)

3. **Sidecars** (`lineage/{repo}/understanding/{slug}.md`) — `confidence_per_field` annotations gain `VERIFIED-VIA-PROBE-RUN-NNN` for fields whose claims were measurement-confirmed; or `LOW (superseded by probe-run-NNN)` for fields whose claims were contradicted. The orchestrator does NOT modify the sidecar's narrative content; it adds the confidence annotation only. A separate `/enrich --node <id> --reason superseded-by-probe` invocation regenerates the sidecar's narrative under the new evidence.

### A new subagent: `probe-runner`

System prompt at `.claude/agents/probe-runner.md`. Tools: `Read, Glob, Grep, Bash, Write`.

The `Bash` tool is required and is a deliberate departure from the other subagents (file-analyser, concept-merger, adr-archaeologist, doc-gap-finder, test-coverage-mapper, feature-advisor, feature-flow-builder — all read-only). The probe-runner *executes* the probe: brings up the docker-compose stack, issues curl / psql / playwright invocations, captures stdout/stderr, tears down. Safety rules in the system prompt:

- The `Bash` tool runs commands only under `lineage/_extractor/probe-runtime/` (the scripts that wrap docker-compose, curl, psql, etc.) — never arbitrary commands from the probe definition. Probe steps are interpreted by the runner; the runner is the only thing executing `Bash`.
- The runner refuses to execute a probe whose declared `arrange` includes anything outside the allowed surface (DB inserts via the named-stack's exposed port; REST calls via the named-stack's exposed port; config flips to the named-stack's mounted config volume). Any attempt to escape this scope (write to `/etc/`, fork a process, run `npm install`, etc.) fails the probe with `outcome: ERROR / verdict_reason: probe scope escape attempt`.
- The runner refuses to execute a probe whose `verified_against_commit` lags the substrate's `last_scan_commit` by more than the staleness threshold without an explicit `--allow-stale` flag.
- The runner never modifies the system-under-analysis source code. The mirror's contents are entirely inside the docker volumes, which are destroyed at teardown.

### A new skill: `/probe-run`

Maintainer-facing entry point at `.claude/skills/probe-run/SKILL.md`. Argument forms:

| Form | Behaviour |
|---|---|
| `/probe-run <probe-id>` | Execute one probe; produce one probe-run artefact; merge updates into feature-flows.yaml + test-map.yaml + sidecar confidence annotations. |
| `/probe-run --feature <feature-id>` | Execute every probe whose `feature_id` matches; produce N probe-run artefacts. |
| `/probe-run --batch` | Execute every probe whose `verified_against_commit` matches the current substrate commit (i.e. every non-stale probe). Multi-probe round; uses shared `docker-compose up`/`down` to amortise setup cost. |
| `/probe-run --dry-run <probe-id>` | Parse the probe definition; validate its scope declaration; report what it WOULD do without actually bringing up the stack. |
| `/probe-run --show <probe-id>` | Read-only; print the probe definition + the most recent probe-run artefact for that probe. |

A complementary `/probe-define` skill is anticipated but deferred to slice 4: it would help the maintainer author probe definitions from feature-flows.yaml's uncovered-cells (each empty cell in a feature's test matrix becomes a probe-skeleton candidate).

### Workflow — the new cycle

The rev-2 cycle (substrate → enrich → 5 reducers → probe Type-7 → commit) gains a concrete shape for the Type-7 probe step:

```
substrate scan                    → nodes.jsonl + edges.jsonl + rollups
enrich --batch <entry-points>     → 5 sidecars (v0.3.0 schema)
reduce concept-merger             → concepts.yaml refresh
reduce adr-archaeologist          → implicit-adrs.md + refactoring-scopes.md refresh
reduce doc-gap-finder             → doc-gaps.md refresh
reduce test-coverage-mapper       → test-map.yaml refresh
reduce feature-flow-builder       → feature-flows.yaml refresh
/probe-define (when needed)       → 2-5 new probe definitions per batch         ← rev 3 NEW
/probe-run --batch                → probe-runs/*.yaml + measured-truth merge     ← rev 3 NEW
                                    feature-flows.yaml.observed_vs_expected updates
                                    test-map.yaml.test_matrix cell flips
                                    sidecar confidence annotations
commit + open PR
```

Each batch produces both static and measured artefacts. Over time the methodology builds up a probe corpus that empirically grounds the static layers.

### Migration path

The dynamic-verification layer is **forward-compatible with rev 2**:

- All existing rev-1 and rev-2 artefacts stay valid. Sidecars at v0.3.0 stay v0.3.0; confidence annotations are appended, narrative content is unchanged.
- `feature-flows.yaml` gains optional `observed_vs_expected.measured` alongside the existing `observed` (which retains its inferred value). The schema is forward-compatible; pre-rev-3 features with no measurement carry `provenance: inferred`.
- `test-map.yaml`'s per-feature matrix gains the new cell states (`PROBED-PASSING`, `PROBED-PINNING-BUG`, `PROBE-TEST-DISAGREEMENT`) alongside the existing (`COVERED`, `PARTIAL`, `GAP`, `PROBED-COMPLETED`).
- New artefacts at `lineage/{repo}/probes/*.yaml` + `lineage/{repo}/probe-runs/*.yaml`. New subagent `probe-runner` + new skill `/probe-run`. New ephemeral docker-compose profiles at `lineage/_extractor/probe-stacks/`.
- No big-bang migration. Probe corpus grows batch-by-batch. Features without probes carry `provenance: inferred` indefinitely without harm.

The first slice produces 3 probes covering the F-001 view_count feature; sublater slices grow the corpus across the highest-leverage feature-flows.

## Consequences

### What this enables

1. **The view_count doubling bug becomes empirically verified, not just inferred.** Probe P-001 measures the actual UI page-open → DB delta, lands `observed: +2 (measured run R-001)` in feature-flows.yaml#F-001, and pins TEST-GAP-256 + TEST-GAP-309 as `PROBED-PINNING-BUG`. When the fix lands, the probe's assertion flips and the test-matrix cell flips to `PROBED-PASSING`.

2. **Performance-class findings gain real units.** REFACTOR-221 (no view_count index) gains a measurement: `Popular page p99 = 230ms at 50K-entity seed (measured run R-NNN)`. The fix's value becomes quantifiable; regression-pinning becomes automatic.

3. **Security-adversarial findings gain executable verification.** REFACTOR-073 (DISABLED-mode bypass) gains 17 probes (one per affected endpoint) that all confirm anonymous reachability under `auth.type=DISABLED`. The cluster is no longer structural inference; it is empirically demonstrated.

4. **Confidence calibration across the whole ontology rises.** Sidecars whose inferences are empirically confirmed shift to `confidence: VERIFIED-VIA-PROBE`. Sidecars whose inferences are contradicted shift to `LOW`. The maintainer can prioritise re-enrichment of the contradicted ones; the confirmed ones can be skipped on future refreshes. Token budget naturally re-allocates to where it matters.

5. **The 4-class test matrix becomes empirically populated.** Many features in feature-flows.yaml carry `state: GAP` across the matrix today, with proposed-test-files but no executed assertions. Probes empirically populate at least the integration and security cells without requiring code-base test additions. The test pillar's eventual backlog shrinks because many gaps are already pinned by probes.

6. **Documentation alignment becomes measurable.** A DOC-GAP-NNN finding gains a quantitative payload: doc says X, system measures Y, delta is `|Y - X|` in the unit that matters. The maintainer's 0%-gap ambition becomes a number, not an aspiration.

### What this costs

- **A new subagent with `Bash` capability.** First subagent in the methodology with execute permissions. Safety surface designed explicitly (Rules 6-7 above); failure of the safety surface compromises the local workstation. Risk class is qualitatively different from read-only subagents.
- **Docker / Podman dependency on the maintainer's workstation.** ODD's `trylocally` already requires this; the methodology now binds to it. A maintainer without a local container runtime cannot run probes (but can still run all of layers 1-4).
- **Workstation resources for the mirror.** ODD's full stack on docker-compose is ~3 GB RAM + 5 GB disk + N cores. Reasonable on modern dev machines; not free.
- **Probe-corpus maintenance.** Probes have versions and staleness; the maintainer carries the burden of updating them as the substrate evolves. The staleness-finding mechanism surfaces drift, but doesn't fix it.
- **Time-to-result on heavy probes.** Performance probes that need 50K-entity seed + load injection run for minutes. A full `/probe-run --batch` for ODD's eventual probe corpus might run 15-30 minutes. The static cycle still runs in seconds; the dynamic cycle is the new long pole.

### What does NOT change

- The substrate ADR (`code-lineage-substrate.md` rev 3) is unchanged.
- The agentic-code-ontology ADR (`agentic-code-ontology.md` rev 3) is unchanged.
- The feature-anchored-ontology ADR (`feature-anchored-ontology.md` rev 1) is extended via this ADR's measured-truth feedback into feature-flows.yaml; no schema change to feature-flows.yaml's frontmatter or body shape beyond the optional `measured` annotation.
- All existing rev-2 non-negotiable rules carry forward: live URLs for docs; code-anchor mandate; one sidecar per node per invocation; no source code modification; no absolute paths; banned phrases; maintainer-curated entries survive refresh; probe-driven acceptance; code-is-truth-docs-are-audit-target; entry-points-are-unit-of-analysis; features controlled along 4 axes; **local-only execution** (the rule this layer is constrained by).

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| Mirror drift from production (the local stack differs from real ODD deployments in ways that hide bugs) | Mirror configuration pinned to ODD's published `trylocally.md` setup; deviations are documented in `lineage/_extractor/probe-stacks/README.md`. The mirror is a deliberate-known approximation, not a production clone. |
| Probe staleness (substrate moves; probes lag; measurements become misleading) | `verified_against_commit` field on every probe; probe-runner refuses to execute (without explicit override) probes that lag the substrate by more than 5 commits. Staleness reporting in batch output. |
| Bash-capable subagent compromises the workstation | Subagent's allowed commands restricted to a wrapper script set under `lineage/_extractor/probe-runtime/`. Probe definitions are declarative YAML; the runner interprets them but does NOT execute arbitrary commands from them. Probe scope is declared on write; violations surface as ERROR outcomes. |
| Resource exhaustion (multiple probes running concurrently exhaust local memory) | `/probe-run --batch` serialises probe execution; `docker-compose up`/`down` between probes by default. Parallel mode behind an explicit `--parallel <N>` flag with documented resource budget. |
| Probe-test disagreement (a test asserts X; a probe measures Y; both are committed; nobody knows which is right) | A new test-matrix cell state `PROBE-TEST-DISAGREEMENT` surfaces the conflict and demands maintainer triage. This is *good* — it surfaces bugs that one or the other was hiding. Don't auto-resolve; flag for human review. |
| Probe maintenance burden becomes the new bottleneck | Probes are skeletal by design (3-5 lines of declarative steps each); /probe-define skill (deferred to slice 4) auto-generates skeletons from feature-flows.yaml's uncovered cells. The maintainer authors intent + assertion; the runtime generates arrange + observe boilerplate. |
| The local-only constraint forces compromise on probe realism (e.g. small data volumes, mocked externals) | Documented explicitly per probe — `realism_caveats:` field in the probe artefact. Performance probes carry the caveat "measured against N-entity seed; production-shape unknown without dedicated environment." The constraint is honored; the limit is documented; future scaling-up of probe realism is a separate decision. |

## Related

- LSN-017 — trigger incident retrospective (view_count doubling miss + the methodology conversation that produced this ADR)
- ADR-DRAFT-feature-anchored-ontology — the layer this ADR extends (provides feature_flows.yaml as the probe target catalog)
- ADR-DRAFT-agentic-code-ontology — the layered foundation (provides the sidecar schema this layer reads)
- ADR-DRAFT-code-lineage-substrate — the structural seed (provides substrate IDs that probes reference)
- APPROACH.md sections 5 (rule 12 — local-only execution) + 9 (cost discipline) — the load-bearing operational invariant for this layer

## Open questions deliberately not addressed in this ADR

None. Every design choice is anchored: in the local-only constraint (APPROACH.md), in LSN-017's forcing question, in the existing layered-ADR pattern, in the existing feature-flows.yaml schema, in the OSS-maintainer cost envelope. Slice-by-slice implementation surfaces detail that this ADR specifies generically (probe-stacks compose file shape, probe-runtime wrapper scripts, /probe-define skeleton generation logic) — those are implementation slices, not design questions, and they implement this ADR without requiring revision.

If a slice during implementation surfaces a contradiction with this ADR, the slice triggers a revision-2 of this ADR (not a new ADR) per the established pattern.

## Implementation slices

1. **Slice 1 — methodology surface** (this batch): this ADR. The methodology principle (inferred-vs-measured) is documented; the probe + probe-run schemas are specified; the probe-runner subagent shape is defined; the /probe-run skill contract is defined. No probes authored yet, no probe-runner subagent built yet. Slice 1 is paper.

2. **Slice 2 — first-experiment, view_count F-001 end-to-end** (next batch):
   - Build `lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml` (a minimal ODD stack: Postgres + Spring Boot backend + minimal seed).
   - Build `lineage/_extractor/probe-runtime/runner.py` — the wrapper that the probe-runner subagent invokes (executes arrange / act / observe / cleanup steps from a probe definition; emits the probe-run YAML).
   - Author the probe-runner subagent (`.claude/agents/probe-runner.md`) with Bash safety rules + scope-declaration validation.
   - Author 3 probes for F-001: P-001 (integration: open detail page via headless browser, assert DB +2 per page-open); P-002 (security: under auth.type=DISABLED, anonymous reachability of detail page); P-003 (performance: latency p99 at 1K seeded entities).
   - Author the `/probe-run` skill (SKILL.md + minimal orchestration).
   - Run end-to-end. Validate that observed values land in feature-flows.yaml; that the test-matrix cell flips; that sidecar confidence annotations are added.
   - If 3-of-3 probes execute and the feedback loop closes, methodology has signal; promote to slice 3.

3. **Slice 3 — probe corpus growth across batch-G findings**:
   - Authors 10-15 probes covering:
     - Term path-mismatch (P-NNN: send authenticated caller without DATA_ENTITY_ADD_TERM, assert 200 — pins the bug; flips to assert 403 when fix lands)
     - Description Markdown round-trip (P-NNN: PUT containing `<script>`, GET back, assert script tag presence — pins XSS surface)
     - Tag auto-create scope-asymmetry (P-NNN: caller with DATA_ENTITY_TAGS_UPDATE only, PUT tags, assert global tag directory grew)
     - Owner unlinked silent-empty (P-NNN: caller with no owner mapping, GET /api/dataentities/my, assert 200 + [])
     - lineage_depth NPE (P-NNN: omit lineage_depth, GET /api/dataentities/{id}/lineage/downstream, assert current 500)
     - Popular EXCLUDE_FROM_SEARCH bypass (P-NNN: entity with exclude_from_search=true + high view_count, GET /api/dataentities/popular, assert entity present — pins the bug)
   - Each probe gets cross-referenced from its REFACTOR-NNN / TEST-GAP-NNN / DOC-GAP-NNN entries.

4. **Slice 4 — /probe-define skill** + probe-skeleton generation from feature-flows.yaml uncovered cells. Maintainer burden of probe authoring drops; corpus growth accelerates.

5. **Slice 5 — multi-feature probe orchestration** (`/probe-run --batch`): shared docker-compose lifecycle across probe set; per-feature aggregated measurement reporting; integration with the existing investigator-log.md format (each batch's investigator-log entry now carries a probe-runs section alongside reducer diffs).

Slices 2-5 are deferred to subsequent batches. Slice 1 (this ADR) is this batch.
