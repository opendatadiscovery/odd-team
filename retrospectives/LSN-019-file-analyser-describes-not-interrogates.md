---
id: LSN-019
title: File-analyser describes what the code says; it does not interrogate what the code does
date: 2026-05-20
domain: workspace-meta (agentic-ontology methodology — every pillar)
severity: critical
gates_informed:
  - .claude/agents/file-analyser.md (system prompt — must bolt in the Stress Protocol as a non-negotiable pre-emit phase)
  - lineage/_extractor/registry-shard/coverage.py (the "75% effective" metric was vanity — must distinguish probe-verified truth from static-inferred guess)
  - lineage/odd-platform/probes/ (analyser-emitted probe skeletons become first-class — the channel for code-traceable answers that need runtime confirmation)
  - adrs/drafts/feature-anchored-ontology.md (rev-4 — methodology must include the interrogation phase between read and emit)
  - APPROACH.md (universal methodology — "code is truth" implies "code must be interrogated, not transcribed")
related_lsn:
  - LSN-018 (cross-batch reducer contradiction — sibling: artefacts said opposite things; the fix added a coherence-sweep AFTER emit)
  - LSN-017 (per-node-scan-cannot-see-cross-layer-user-effects — sibling: the ontology was silent on a cross-layer fact; the fix added layer-4 feature-flow synthesis)
  - LSN-016 (heuristic-substrate-no-semantic-content — ancestor: substrate had structure but no meaning; the fix added layer-3 per-node enrichment)
status: open
---

# LSN-019: File-analyser describes what the code says; it does not interrogate what the code does

## What happened

On 2026-05-20, after twenty-six batches of agentic-ontology enrichment had reached 295/395 effective coverage (74.7%) / 30 pillar-anchored features / hundreds of test-gaps / scores of doc-gaps / a methodology purportedly converged on "the operator can trust this ontology", the maintainer ran an empirical test:

> *"What would happen in the UI if there are 35 tags created in the registry and every entity is tagged by all of them — what shows on the main page?"*

Using only the ontology (no source-code reads allowed), the answer derived from the registry artefacts was: *"30 tags shown on TopTagsList, ordered by descending usage count per `tagService.listMostPopular`, non-deterministic among the tied entries."*

The maintainer's empirical answer (verified by running the platform locally): *"30 tags shown, ordered NOT by usage count but by **creation timestamp ascending** — i.e. the oldest 30 tags. `listMostPopular` is misnamed; the JOOQ chain has no ORDER BY count, so the natural row order (creation order) wins. The UI label 'Top Tags' is therefore a lie at the protocol level: it is 'Oldest Tags' for any registry where N > 30."*

The ontology said one thing. The running platform did another. The ontology was authored by the file-analyser, which had read TagController, read tagService.listMostPopular, read the JOOQ chain, and emitted a sidecar claiming *"orders by descending count"* — because the **method's name** says so, because the **CTE** computes a count column, because the surface-level read of the code reasonably suggests popularity ordering. But the file-analyser never asked the question a senior engineer would have asked instantly: *"the SQL has a count column; does the OUTER select actually `ORDER BY count DESC`? trace the JOOQ chain end-to-end. and what about ties — when 35 tags all have the same usage count, what determines the cut to 30?"* The answer was right there in the code — visible in 30 seconds of careful reading or 60 seconds of running the query mentally with all-equal-count data — and the methodology generated neither the question nor the answer.

## Why it slipped

The failure is not about TagController. The failure is **a structural property of the file-analyser system prompt**: it tells the analyser to *describe* what the code does (read it, walk neighbours, emit `understanding` + `concepts` + `dependencies_semantic` + `tests_coverage_semantic` + `docs_link_semantic` + `implicit_adrs` + `bugs_limitations_corner_cases` + `security` + `performance` + `upstream_callers` + `downstream_side_effects`); it does NOT tell the analyser to *interrogate* what the code does at boundaries, name-behavior pairs, orderings, auth modes, or resource limits.

A senior engineer reading `size: 30` does not stop at "this fetches 30." They auto-fire: *what at N=0? at N=31? at N=10000? what determines which 30? what's the tie-break? what does the operator see when the underlying set exceeds the limit?* — then answer each by tracing the code or running a probe. A senior engineer reading `listMostPopular` does not stop at "this returns popular tags." They auto-fire: *the name promises popularity; does the SQL deliver it? trace the chain. read the OUTER select. look for `ORDER BY count`. if absent — what does the natural row order produce?*

The file-analyser prompt has none of these questions baked in. Its `bugs_limitations_corner_cases` section invites free-form observation; observations only appear if the analyser happens to think of them. Without forcing question-generation, the analyser defaults to descriptive transcription — which gives the right answer at the surface (`listMostPopular` *is* the method's name) and the wrong answer at the boundary (the method's behavior does NOT match its name).

This is the same shape as LSN-016, LSN-017, LSN-018:

| LSN | Class | What was missing |
|---|---|---|
| LSN-016 | The substrate had structure but no meaning | A layer above (per-node enrichment) that adds semantic content |
| LSN-017 | Per-node enrichment was correct in isolation but composed wrong at the user level | A layer above (feature-flow synthesis) that composes cross-layer facts |
| LSN-018 | Reducers emitted contradictory artefacts because none cross-checked the others | A layer transverse to all reducers (coherence sweep) that detects contradiction |
| **LSN-019** | **The file-analyser describes; it does not interrogate** | **A non-negotiable interrogation phase WITHIN the file-analyser, before emit, that auto-generates and auto-answers stress questions on triggers detected in the code** |

LSN-016/017/018 added layers above or transverse to existing layers. LSN-019 fixes the *behavior of an existing layer* — the file-analyser was already running on every node; it just wasn't asking the right questions.

The deepest cause: **the methodology's coverage metric ("75% effective") counts nodes touched, not claims verified**. A node with a sidecar gets counted as "covered" regardless of whether the claims in the sidecar are STATIC-INFERRED guesses (the natural output of "describe what the code says") or PROBE-VERIFIED truths (the output of "interrogate what the code does"). The vanity metric let the methodology feel done while the substantive question — *can the operator trust this ontology?* — remained unanswered. `listMostPopular`'s drift sat in the registry, with `confidence: HIGH`, for weeks. Any operator who searched the ontology for *"how does ODD's TopTags ranking work?"* would have read the wrong answer with confidence.

## Rule that emerged

**The file-analyser interrogates; it does not transcribe.** Before emitting any sidecar, the file-analyser runs a **Stress Protocol** — five categories of structural interrogation, each fired by triggers detected in the code, each answered before emit. The categories:

1. **Tunables** — every numeric constant / `@Value` default / page size / limit / timeout / retry / cache TTL. Questions: what at N=0 / N=1 / N=tunable / N=tunable+1 / N=tunable×100; what at null / negative; what at degenerate values; what does the operator see at each boundary.
2. **Name-behavior pairs** — every method / endpoint / annotation whose name promises observable behavior. Questions: what does the name *promise*; what does the implementation *actually do* (read the SQL chain end-to-end, including paginate-wrappers and decorators); does the implementation match the promise; if not, what is the operator-visible drift.
3. **Orderings / pagination / aggregation** — every `ORDER BY` / `LIMIT` / `paginate(...)` / `.sort(...)` / GROUP BY. Questions: what is the actual ORDER BY at the lowest layer; what is the tie-breaker when sort-key values are equal; is it deterministic; what subset is returned when result-set exceeds page size; does any layer re-sort.
4. **Authorization gates** — every controller endpoint, `@PreAuthorize`, programmatic auth check. Questions: what does this endpoint return for each of the 4 auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP); what does an unauthenticated caller see; what does a wrong-role caller see; where does the gate live (controller / service / repository / nowhere).
5. **Resource boundaries** — every `@Transactional` / `synchronized` / cache / `ON CONFLICT` / `@Async`. Questions: can two simultaneous calls produce corrupted state; is the call replay-safe; if a cache fronts this, what is the TTL / eviction key / staleness window.

Each question gets exactly ONE of three answers:

- **Trace-answer** — the answer is in the code (this file + 1-hop neighbours); the analyser records it with `confidence: STATIC-INFERRED` and `file:line` evidence.
- **Probe-answer** — the answer requires running the system; the analyser **emits a concrete probe-skeleton** at `lineage/{repo}/probes/P-{NNN}.yaml` (next free ID; `emitted_by: file-analyser`; `status: pending-stress-protocol`) with arrange/act/observe filled in concretely; the sidecar records `confidence: PROBE-NEEDED` + the probe_id. The probe-runner subagent picks pending probes up on its next batch and resolves them; the resolved value flips the sidecar's confidence to PROBE-VERIFIED.
- **Out-of-scope** — the answer lives in another node's sidecar (e.g. UI-side question in a backend sidecar); the analyser records `confidence: REFERENCE` + the node_id of the sidecar that should answer it.

You may not skip a triggered question. Every trigger detected → every question answered (via one of a/b/c). The sidecar's new `stress_findings` block carries the questions + answers; it is sized by the code's complexity, not by the analyser's intuition.

This rule lives in `.claude/agents/file-analyser.md` as **Rule 9 — Stress Protocol (NON-NEGOTIABLE)**, with a worked example using the `listMostPopular` incident as case-law.

A second rule emerges from the vanity-metric observation: **the coverage metric must distinguish probe-verified claims from static-inferred guesses**. `lineage/_extractor/registry-shard/coverage.py` gains a `stress_verified_pct` axis that counts the fraction of stress questions answered by `PROBE-VERIFIED` (vs `STATIC-INFERRED`, `PROBE-NEEDED`, or `REFERENCE`). The maintainer's reading of "we are at X% coverage" then carries an honest meaning: not *"X% of nodes have a sidecar"* but *"X% of load-bearing operator-observable claims have been measured against the running system."* The old "effective coverage" metric remains, retitled as "static enrichment coverage", so its limits are explicit.

## Forcing question

The one question that, asked at sidecar-emit time, would have caught the `listMostPopular` drift (and the class of misses LSN-019 covers):

> **"For every concrete tunable, name-behavior pair, ordering clause, auth gate, and resource boundary in the code I just read — what does the code DO at each boundary, in each degenerate case, under each operator-visible condition? If I cannot answer from the code alone, what is the probe I would run, written concretely enough that the probe-runner can execute it?"**

The current file-analyser prompt asks *"what does the code say?"* and emits a description. The forcing question asks *"what does the code do at each boundary?"* and emits a description PLUS a stress-findings block PLUS (when needed) a probe skeleton. The two answers diverge wherever the code's behavior at a boundary differs from the code's surface meaning at the centre — which is exactly where operators get hurt.

This is the structural twin of LSN-017's and LSN-018's forcing questions. LSN-017 caught cross-layer composition; LSN-018 caught cross-artefact contradiction; LSN-019 catches **boundary-condition silence within a single node's enrichment**. The next layered class (LSN-020) will catch what the Stress Protocol cannot see — but until then, the protocol closes the largest currently-visible gap in the methodology.

## How this differs from LSN-016 / LSN-017 / LSN-018

- **LSN-016** added a *new layer above the substrate* — per-node enrichment, because the substrate alone carried no meaning. The fix shape: stack a layer.
- **LSN-017** added *another new layer above per-node enrichment* — feature-flow synthesis, because per-node facts compose into cross-layer user effects that no single node's sidecar could see. The fix shape: stack another layer.
- **LSN-018** added a *sweep transverse to all reducers* — coherence detection, because parallel reducers emitted contradictions that no individual reducer could catch. The fix shape: add a transverse check.
- **LSN-019** fixes the *behavior of an existing layer* — the file-analyser was already running; the fix is to make it interrogate instead of transcribe. The fix shape: change what the analyser DOES inside its existing scope.

The deeper generalization: **every prior LSN exposed a class of question the methodology was not generating**. The fix in each case was to bake the question-generation into the methodology itself, at the appropriate scope. LSN-019 bakes *boundary interrogation* into the per-node scope. LSN-020 will bake whatever the next maintainer test exposes into whatever scope that turns out to live in. The methodology is a discipline of perpetual question-generation, not a fixed pipeline.

## References

- File:line evidence (ground truth that `listMostPopular` returns oldest, not most-popular)
  - `odd-platform-api/src/main/java/.../tag/TagService.java` — the `listMostPopular` method signature
  - `odd-platform-api/src/main/java/.../repository/reactive/ReactiveTagRepositoryImpl.java` — the JOOQ chain backing `listMostPopular`; the OUTER select carries no `ORDER BY count` clause
  - `odd-platform-ui/src/components/Overview/.../TopTagsList.tsx` (or sibling) — the `size: 30` callsite that fixes the truncation
  - The maintainer's empirical test (2026-05-20) — observed: 35 equally-tagged tags, the UI shows the 30 OLDEST, not 30 by usage count
- Registry artefacts (the descriptive transcription that the Stress Protocol would have caught)
  - `lineage/odd-platform/understanding/odd-platform__java__TagController__controller-class__TagController.md` — the sidecar that claimed "orders by descending count"
  - `lineage/odd-platform/feature-flows/detail/F-018.yaml` — the feature artefact that propagated the wrong claim into a pillar-anchored feature
- The file-analyser prompt that produced the descriptive sidecar (the lever this LSN changes)
  - `.claude/agents/file-analyser.md` — to gain Rule 9 (Stress Protocol) as a non-negotiable phase
- The vanity coverage metric that masked the substantive question
  - `lineage/_extractor/registry-shard/coverage.py` — to gain `stress_verified_pct`
- Probe ecosystem (analyser-emitted skeletons become first-class)
  - `lineage/odd-platform/probes/` — gains `pending-stress-protocol` probes from this point forward
  - `.claude/agents/probe-runner.md` — gains a flow for picking up analyser-emitted probes (next-batch follow-up)

## Process change checklist (to be applied in this session)

- [x] Write LSN-019 (this file)
- [x] Add **Rule 9 — Stress Protocol (NON-NEGOTIABLE)** to `.claude/agents/file-analyser.md`
- [x] Add the `stress_findings` block to the sidecar schema in `.claude/agents/file-analyser.md`
- [x] Add a workflow step (between "Synthesise the sidecar" and "Self-check") that runs the Stress Protocol
- [x] Add `stress_findings` confidence to `confidence_per_field`
- [x] Add the probe-skeleton format spec (inline in `.claude/agents/file-analyser.md` Rule 9, with the worked `listMostPopular` example)
- [x] Extend `lineage/_extractor/registry-shard/coverage.py` with a `stress_verified_pct` axis (with explicit denominator = total stress questions across all sidecars)
- [x] Update `feedback_linus_torvalds_engineering_bar.md` memory: remove the obsolete reference to a "maintainer-knowledge input channel" — the methodology generates its own questions
- [x] Update `APPROACH.md` to rev 4 — Failure C added to section 2; sidecar schema extended with `stress_findings` in section 4.3; rules 13 + 14 added to section 5; Type-8 probe class added to section 7; honest coverage metric framing in section 5; bootstrapping signals added to section 11; LSN-018 + LSN-019 references added to section 12; **new section 14 "Stress Protocol — Layer 2 interrogation (rev 4)"** authored as the canonical portable methodology surface for this layer
- [x] Queue `VAL-LSN-019` validation theme in `state/sprint-themes.yaml` — TagController rewrite + ReactiveTagRepositoryImpl rewrite + TagServiceImpl fresh enrichment, under file-analyser/0.4.0
- [ ] (Maintainer hand) Update `adrs/drafts/feature-anchored-ontology.md` to rev 4 — the ADR's formal methodology design picks up rule 13 and section 14 (CLAUDE.md guard: ADR drafts are maintainer-authored design proposals)
- [ ] (Follow-up batches) Re-pass the existing 143 sidecars under the Stress Protocol — mark each one's `enrichment_status` as `stress-complete` or `stress-incomplete`. Queue as one batch theme per ~5-sidecar group via `state/sprint-themes.yaml`
- [ ] Promote LSN-019 status to `closed` only after the Stress Protocol has run on at least one full batch (VAL-LSN-019 minimum) and produced a non-empty `stress_findings` block per sidecar with at least one PROBE-VERIFIED resolution
