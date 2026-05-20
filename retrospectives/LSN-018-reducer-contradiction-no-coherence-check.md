---
id: LSN-018
title: Cross-batch reducer contradiction — artefacts assert opposite truths because reducers never coherence-check each other
date: 2026-05-19
domain: workspace-meta (agentic-ontology methodology — every pillar)
severity: critical
gates_informed:
  - adrs/drafts/feature-anchored-ontology.md (the layered-ADR — rev-3 must gain coherence-check protocol)
  - .claude/agents/{test-coverage-mapper,doc-gap-finder,adr-archaeologist,concept-merger,feature-flow-builder}.md (reducer system prompts — must add pre-emit coherence step)
  - .claude/skills/next-batch/SKILL.md (orchestrator — must add post-batch coherence-sweep step)
  - APPROACH.md (universal methodology — coherence-by-back-links becomes a principle)
related_lsn:
  - LSN-017 (per-node-scan-cannot-see-cross-layer-user-effects — sibling failure: ontology was SILENT on a fact)
  - LSN-016 (heuristic-substrate-no-semantic-content — ancestor: each layer above catches what the layer below cannot)
status: open
---

# LSN-018: Cross-batch reducer contradiction — artefacts assert opposite truths because reducers never coherence-check each other

## What happened

On 2026-05-19, after fourteen batches of agentic-ontology enrichment had reached 83/395 direct sidecars / 39.7% effective coverage / 18 pillar-anchored features / 577 test-gaps / 160 doc-gaps / 389 refactoring-scopes / 131 implicit-ADRs / 246 concepts, the maintainer noticed a direct contradiction between two registry artefacts that had been live for multiple batches:

**Artefact A — F-010 (created in batch K, 2026-05-19)**

`lineage/odd-platform/feature-flows/detail/F-010.yaml`, pillar-anchored as `P-08:F-002 Housekeeping TTL Enforcement`, enumerates **FIVE housekeeping jobs** including:

> *"SearchFacetsHousekeepingJob (TTL — `housekeeping.ttl.search_facets_days`)"*

with `last_accessed_at` as the eviction key, default 30 days.

**Artefact B — TEST-GAP-523 (created in batch M, 2026-05-19)**

`lineage/odd-platform/test-map/detail/TEST-GAP-523.yaml`, regression-pin against `SearchController.facets`, asserts:

> *"NO TTL eviction, NO row deletion on user logout, NO archive policy. … The `V0_0_52__introduce_housekeeping.sql` policy list has NO `search_facets` entry (verified by sidecar grep during enrichment) — the TTL TODO at `V0_0_1__init.sql:207` (`find a way to define TTL`) was never implemented."*

These two claims **cannot both be true**. Ground-truth from the upstream repo:

- `odd-platform-api/src/main/java/.../housekeeping/job/SearchFacetsHousekeepingJob.java` — a `@Component` bean implementing `HousekeepingJob`, running inside the 5-job cycle, deleting rows where `LAST_ACCESSED_AT <= now() - searchFacetsDays`.
- `odd-platform-api/src/main/resources/db/migration/V0_0_52__introduce_housekeeping.sql` — adds `last_accessed_at TIMESTAMP NOT NULL` to `search_facets` (the migration's *whole purpose* is enabling search-facets TTL eviction).
- `odd-platform-api/src/main/resources/application.yml:169` — `housekeeping.ttl.search_facets_days: 30` (default).
- `V0_0_1__init.sql:207` carries a `TODO: find a way to define TTL` comment that was **superseded by V0_0_52 plus the job class** — the TODO never got deleted (an artifact of repo hygiene, not a missing feature).

**F-010 is correct. TEST-GAP-523 is factually wrong.**

The test that TEST-GAP-523 proposes — *"trigger ALL existing housekeeping jobs, then assert search_facets row count UNCHANGED"* — would, if implemented, **fail immediately on a real platform** because the housekeeping job DOES touch `search_facets` exactly as designed.

The miss is not the wrong assertion on its own. **The miss is that the wrong assertion sat in the registry, two batches after the correct one, with no machinery detecting the contradiction.** The maintainer caught it by reading the artefacts; the methodology produced neither a warning during emit nor a sweep after commit nor a back-link on either artefact that would have surfaced the conflict.

## Why it slipped

Four structural causes, in increasing order of root-ness.

**1. The batch-M sidecar (`SearchController.facets`) inferred from too narrow a code-scope.** The file-analyser walked the controller → service → repository chain and observed three negatives: no TTL column on the *table* (false — V0_0_52 added one); no deletion in the *controller* path (true but irrelevant — deletion lives in housekeeping); no housekeeping-related grep hit *within the controller's reachable graph* (false — the file-analyser never grep'd `SearchFacets*Housekeeping*` or `housekeeping.ttl.search_facets_days` outside the controller chain). The negative inference was correct *within the chosen scope* and wrong *for the registry*.

**2. The test-coverage-mapper reducer trusted the sidecar without cross-checking against features.** The reducer's dedup protocol greps `test-map/index.yaml` for existing test-gaps with overlapping behaviour text — *to avoid emitting the same gap twice*. It does **not** grep `feature-flows/index.yaml` or `concepts/index.yaml` for the named entities (`search_facets`, `SearchFacets*Housekeeping*`) to check whether the asserted *absence* of a feature contradicts an asserted *presence* of the same feature in the feature registry. The protocol distinguishes DEDUP (do we already have this?) from COHERENCE (does this contradict what we already have?). Only the first is wired up.

**3. The artefact schema does not require back-links.** F-010 declares `contributing_nodes: [HousekeepingJobManager]` but carries **no** `test_gaps_related`, `doc_gaps_related`, `refactors_related`, `concepts_related` block. TEST-GAP-523 declares `cross_references: [TEST-GAP-519, TEST-GAP-521, REFACTOR-141, F-001 (Search and Filtering)]` — it points to F-001 but **not** to F-010, the housekeeping pillar feature it directly contradicts. Even an exhaustive maintainer cannot ask *"show me everything for F-010"* and see TEST-GAP-523 in the answer, because the link does not exist in either direction.

**4. The orchestrator never runs a coherence sweep across registries.** The `/next-batch` skill's Phase 3 runs YAML autofix, markdown-index merge, index rebuild from detail/, coverage refresh — all integrity checks for *one artefact at a time*. No step enumerates new entries this batch and greps the other four registries for *concept-overlap* anomalies. A reducer-emitted contradiction propagates straight through commit + push to the maintainer's reading session.

The deepest cause is **#4**: even if (1)–(3) all hold, a cheap post-batch sweep would have surfaced the contradiction at commit time. Its absence is the structural fix point.

## Rule that emerged

Four principles, to be codified into the rev-3 ADR + reducer system prompts + the `/next-batch` skill.

**1. Back-link bidirectionality is load-bearing.** Every artefact detail file MUST declare which pillar-anchored feature(s) it relates to (`related_features: [F-NNN]` + `related_pillar_features: [P-NN:F-MMM]`), and every FEATURE MUST enumerate its related artefacts (`related_test_gaps: [TEST-GAP-NNN]`, `related_doc_gaps: [DOC-GAP-NNN]`, `related_refactors: [REFACTOR-NNN]`, `related_adrs: [ADR-CANDIDATE-NNN]`, `related_concepts: [<slug>]`). The pillar-anchored two-tier ID system from rev-3 is the linking key; using it ONLY for de-novo classification while NOT enforcing back-links throws away its main value. **An artefact that names an entity already named by a feature has a back-link to that feature, full stop.**

**2. Reducers run a pre-emit coherence check, not just a dedup check.** Before WRITING a new detail file, the reducer:
- Extracts 2-3 named entities, operations, file:line citations, or pillar-feature keywords from the proposed finding text.
- Greps `feature-flows/index.yaml` + `feature-flows/detail/` AND the other four registries' index files for those terms.
- If matches → Reads the matched detail files in full and reasons about coherence:
  - If the new finding *strengthens* an existing claim → emit + back-link.
  - If the new finding *supersedes* an existing claim with clearer evidence → emit + back-link + flag the prior claim as `superseded_by: <new-id>` and append a `coherence_note` explaining the supersede.
  - If the new finding *contradicts* an existing claim without clearer evidence → **DO NOT EMIT**. Surface a `coherence-conflict-batch-N.md` line for maintainer review.

DEDUP catches *"do we already have this fact?"*. COHERENCE catches *"does this fact contradict what we already have?"*. The two are different protocols; both must run.

**3. The orchestrator runs a post-batch coherence sweep before commit.** Phase 3 gains a step: a `coherence-sweep` reducer that enumerates the batch's new artefact IDs (from the trace + the index deltas), greps the other four registries for the named entities in each new artefact's `behaviour` / `description` / `name` / `evidence` fields, and emits `state/coherence-sweep-batch-N.md`. If non-empty → maintainer review before commit. If empty → commit + push as usual. The cost is bounded by *new* artefact count × *registry sizes* — both small in steady state; the sweep is a grep-then-narrow-Read, not a full re-read.

**4. The registry maintains an entity-to-artefact reverse index.** A flat YAML at `lineage/{repo}/coherence/entity-index.yaml` mapping `<entity-or-operation-or-file:line>` → `[{artefact_type, artefact_id, claim_polarity}]`. Reducers update this index on emit; the post-batch sweep uses it as the cheap lookup. When two artefacts disagree on the *polarity* of the same claim (`asserts_present` vs `asserts_absent` for the same entity-operation pair), the sweep flags it. This is the cheapest possible mechanism for catching the F-010 vs TEST-GAP-523 class.

## Forcing question

The one question that, asked at reducer-emit time, would have caught the miss:

> **"Does this finding name any entity, operation, table, file:line, or pillar-feature already present in another registry? If yes — what does that other registry say about the SAME thing, and does this finding strengthen, supersede, or CONTRADICT it?"**

The current reducer dedup asks *"have I seen this same finding before?"* (within-registry). The forcing question asks *"what does the rest of the ontology say about the things I'm naming?"* (cross-registry). The two answers diverge wherever the methodology has accumulated knowledge faster than it has cross-referenced it.

This is the structural twin of LSN-017's forcing question. LSN-017's question caught cross-layer composition; LSN-018's question catches cross-artefact composition.

## How this differs from LSN-017

LSN-017: the ontology was SILENT on a fact (view_count doubling). The fact lived nowhere because no single sidecar's scope contained it. The fix was *adding a layer* (feature-flow synthesis) that COMPOSES per-node facts into per-feature facts.

LSN-018: the ontology was INCONSISTENT on a fact (search_facets TTL exists / does not exist). The fact lived in two places under opposite polarity because no reducer cross-checks artefacts. The fix is *adding a sweep* (coherence-sweep across registries) that DETECTS contradictions before commit, plus *enforcing back-links* so contradictions can be discovered by reading.

Both LSNs are forms of the same generalized class: **knowledge gaps where the methodology's layering is insufficient.** LSN-016 added an enrichment layer above substrate; LSN-017 added a feature-flow layer above enrichment; LSN-018 adds a coherence layer transverse to all four registries. The methodology keeps layering until the next-discovered class is closed; LSN-019 will catch what these three cannot see.

## References

- File:line evidence (ground truth that F-010 is correct, TEST-GAP-523 is wrong)
  - `odd-platform-api/src/main/java/.../housekeeping/job/SearchFacetsHousekeepingJob.java` — the `@Component` bean (entire file, ~22 lines)
  - `odd-platform-api/src/main/resources/db/migration/V0_0_52__introduce_housekeeping.sql:1-7` — adds `last_accessed_at` to `search_facets`
  - `odd-platform-api/src/main/resources/application.yml:169` — `search_facets_days: 30` default
  - `odd-platform-api/src/main/resources/db/migration/V0_0_1__init.sql:204-211` — the obsolete `TODO: find a way to define TTL` comment
- Registry artefacts (the contradiction itself)
  - `lineage/odd-platform/feature-flows/detail/F-010.yaml` — pillar `P-08:F-002`, claims SearchFacetsHousekeepingJob exists and runs in the 5-job cycle (correct)
  - `lineage/odd-platform/test-map/detail/TEST-GAP-523.yaml` — claims no TTL eviction, no housekeeping entry, TTL never implemented (wrong)
- Sidecars that originated the wrong inference
  - `lineage/odd-platform/understanding/odd-platform__java__SearchController__controller-method__facets.md` (batch M) — `bugs_limitations_corner_cases.[6]`, `performance.known_performance_gaps.[4]`, `implicit_adrs.[2]`
- Reducer prompts that did not cross-check
  - `.claude/agents/test-coverage-mapper.md` — dedup protocol, no coherence protocol
  - `.claude/agents/doc-gap-finder.md`, `adr-archaeologist.md`, `concept-merger.md`, `feature-flow-builder.md` — same pattern
- Orchestrator that did not sweep
  - `.claude/skills/next-batch/SKILL.md` Phase 3 — integrity steps are intra-registry only

## Process change checklist (to be applied in this session)

- [ ] Fix TEST-GAP-523 in-place — supersede the wrong claims, add `superseded_note`, add `related_features: [F-010]` back-link
- [ ] Add `related_test_gaps: [TEST-GAP-523]` (now as a *covered-by* not a *gap*) and `coherence_correction_note` to F-010
- [ ] Add `Rule 6 — Pre-emit coherence check` to all 5 reducer system prompts
- [ ] Add Phase 3 step 3.5 `coherence-sweep` to `/next-batch` SKILL
- [ ] Extend artefact schemas with `related_features` / `related_pillar_features` blocks (test-map, doc-gaps, refactoring-scopes, implicit-adrs detail YAML)
- [ ] Extend feature schema with `related_test_gaps`, `related_doc_gaps`, `related_refactors`, `related_adrs`, `related_concepts` blocks
- [ ] Build `lineage/_extractor/registry-shard/coherence_sweep.py` — the cheap grep-then-narrow sweep over new artefacts
- [ ] Build `lineage/_extractor/registry-shard/entity_index.py` — the reverse-index maintainer
- [ ] Backfill back-links across the existing 18 features + 577 test-gaps + 160 doc-gaps + 389 refactors + 131 ADRs (one-time migration; bounded by registry size)
- [ ] Add `state/coherence-sweep-batch-N.md` to `/next-batch` per-batch trace
- [ ] Update `APPROACH.md` with the coherence principle (universal methodology surface)
- [ ] Promote LSN-018 status to `closed` only after the sweep has run successfully on batch O
