---
review_run: 2026-05-22
commit_anchor: ede5d277
prior_review: 2026-05-22-a1 (rev-8 lite panel-report.md)
verdict: changes-needed
validation_status: pre-acceptance-gate
review_cost_estimate: ~95k tokens (one agent, one pass)
---

# Methodology review — 2026-05-22

This is the **first run of the rev-9 single `methodology-reviewer`** (commit 9262cdc), replacing the
six-expert Adversarial Review Panel per `retrospectives/LSN-024`. The prior review is the rev-8 lite
panel-report (`meta-reviews/2026-05-22-a1/panel-report.md`); this run diffs against it across the
format change, per the reviewer contract Rule 3.

## verdict

**changes-needed.** The architecture is sound — that is not in question, and rev-9 itself is a genuine
improvement (a correlated six-agent committee with no memory, retired and replaced with a cheaper
tracing review; this run cost ~95k tokens versus the panel's ~480k–1.4M, a real ~5–14× cut). But the
central fact the last three panel runs reported has not changed and this run confirms it from primary
source: **the methodology's specification has run far ahead of its execution, and the gap is not
closing.** The single most important thing is not another revision — it is to *stop revising and start
executing*: the substrate was last scanned 2026-05-08 (`manifest.yaml:3`), predating revisions 2–9;
the Stress Protocol reaches 18 of 159 enriched sidecars; the probe loop does not upgrade a single
sidecar's confidence; the feature-reflector covers 1 of 31 features; the UI-interaction axis that
`APPROACH.md` §0.3 declares mandatory still does not exist in the substrate. Eight revisions of
machinery, run on a pre-revision substrate, is the accretion anti-pattern §0 names — being committed
by the methodology's own authors while they read the reviews that name it.

## what_changed_since_last_review

The rev-8 panel raised 11 consensus findings + 11 `what_must_improve` items. Diffed against current
artefact state:

- **rank-1 — probe loop does not write back (`probe_verified` = 0).** `partial`, with a correction
  to the prior account. The prior panel said "the probe-runner's write-back step does not execute" and
  routed it as a code gap to confirm. **Ground truth: the write-back code DOES exist** —
  `runner.py:1295 merge_probe_into_sidecars`, *called* at `runner.py:2055` and `:2118`, and **11
  sidecars now carry a `## probe_verifications` section** (`grep -rl '## probe_verifications'
  understanding/` = 11). But it does **not** do what target condition 6 requires: it *appends a note
  section*, it does **not flip `confidence: PROBE-NEEDED` → `PROBE-VERIFIED`**. `manifest.yaml:32
  stress_answers_probe_verified: 0` is unchanged; `grep -c 'confidence: PROBE-VERIFIED'` matches 3
  sidecars, and all 3 are `confidence_per_field` lines describing a *future* flip ("PROBE-NEEDED
  entries flip to PROBE-VERIFIED after P-014…P-017 run" — `ActivityController…md:657`). The 9 archived
  probe-runs (`probe-runs/2026-05-19-P-00*`) all carry `artefacts_updated: []` because they predate
  the merge code. So this is not "the write-back does not execute" — it is "the write-back appends a
  note but does not perform the confidence upgrade the target measures." The finding stands;
  its description was imprecise.
- **rank-2 — feature-reflector (Layer 4b) structurally absent.** `unactioned`. `feature-reflections/detail/`
  still contains exactly one file (`F-021.yaml`, plus a `.broken-yaml-backup`); `feature-reflections/index.yaml`
  lists one reflection. 31 feature-flow detail files exist. Coverage is 1/31 ≈ 3%.
- **rank-3 — Stress Protocol at ~12.6% of enriched sidecars.** `unactioned`. 25 sidecars have a
  `stress_findings` block; 18 have `triggers_total > 0`; `manifest.yaml` records `sidecars_with_stress_section:
  20`. The `prompt_version` spread is unchanged: 12×0.1.0, 86×0.2.0, 41×0.3.0, 8×0.4.0, 17×0.5.0 —
  i.e. 139 of 164 sidecars predate the rev-4 Stress Protocol.
- **rank-4 — `test-map/index.yaml` shard not done.** `unactioned`. `wc -c test-map/index.yaml` =
  **1,438,326 bytes** — byte-identical to the prior run's measurement. `find test-map/detail -name '*.yaml'`
  = 908 files; two `index.delta.*.pending-merge.yaml` files unresolved. SEE the obsolescence note below.
- **rank-5 — rejection criteria have no non-LLM executor.** `partial`. `validators.py` *does* exist
  (`lineage/_extractor/src/lineage_extractor/validators.py`) and enforces banned phrases
  (`:190`) + empty required sections (`:75`). But it does **not** check the rev-4/5 rejection
  criteria — empty `stress_findings` on a trigger-bearing node, missing/zero-hypothesis reflection,
  the numeral-vs-list self-consistency the prior panel's ENG-F3 named. The ActivityHandler
  contradiction the prior panel flagged is still present verbatim
  (`ActivityHandler.md:32` — "Three of the 27 enum values are NOT covered" followed by a list of ~10).
- **rank-6 — LSN-023 closed with its named wrong finding still committed.** `partial / corrected`.
  The prior panel saw `LSN-023: status: closed` and routed this `human-verify`. **The maintainer has
  since reopened it** — commit `84bf67f` "LSN-023 -> open — the 2026-05-22 panel caught a premature
  close"; `retrospectives/LSN-023…md:8` now reads `status: open`. The premature-closure half is
  resolved. But the wrong artefact is **still committed**: `feature-flows/detail/F-031.yaml:9` and
  `:400` still carry `drift_class: permission_side_door` for the `namespace_name → getOrCreate` chain.
- **rank-7 — methodology never run end-to-end at current scope.** `unactioned`. `manifest.yaml:3
  last_scan_date: '2026-05-08'`, `features_with_at_least_one_cell_probed: 4`.
- **rank-8 — `concepts.yaml` monolith stale.** `partial`. The top-level `concepts.yaml` (647 KB)
  is stale, but a sharded `concepts/index.yaml` (470 KB) + `concepts/detail/` (432 files) now exists —
  the shard the prior panel asked for is partly built; the top-level monolith was not retired.
- **rank-9 / rank-11 — feature-flow representation divergence (5 vs 30/31).** `RESOLVED — confirmed`.
  The prior panel's chair could not adjudicate this. Ground truth: `feature-flows.yaml` (top-level)
  says `total_features: 5`, `sidecar_count: 50`, frozen at an old commit — it is a **stale monolith**,
  exactly the staleness class the chair hypothesised. `feature-flows/index.yaml` says `total_features:
  30`; `feature-flows/detail/` holds 31 files (F-001..F-031). The live count is 31.
- **rank-10 — UI-interaction axis / migrations axis absent.** `unactioned`. `manifest.yaml:6-21`
  axes = `ui_shell, openapi_tags, controllers, ui_routes, config_prefixes`. No `ui-interaction`
  axis, no `migrations` axis.

**Net:** of 11 prior findings — 0 fixed, 5 partial, 4 unactioned, 2 resolved-as-questions. The
trend the prior three panels reported (top findings not driving fixes) holds for a fourth review.

## pipeline_trace

End-to-end trace of the live pipeline against what `APPROACH.md` says each stage should be:

- **Substrate (Layer 1).** PRESENT, **STALE**. `manifest.yaml`: 395 nodes / 479 edges, `extractor_version:
  0.1.0`, `last_scan_date: 2026-05-08`. Five axes, all `version: 1`. The scan predates revs 2–9. §0.3 +
  Step 3 (rev 8) declare a UI-interaction axis mandatory — absent. This is the **root blocker**: every
  downstream layer is enriching a pre-revision substrate.
- **Layer 0 — domain-extractor.** PRESENT. `system-mission.md` (55 KB, dated 2026-05-20). Not re-run
  since; acceptable per §13 run cadence (once per substrate scan) — but it inherits the stale substrate.
- **Layer 2 — file-analyser enrichment.** PARTIAL. 164 sidecar files in `understanding/` (159 are
  real nodes per `manifest.yaml:27 nodes_with_own_sidecar: 159`; the rest are README/template — the
  prior panel's denominator-spread observation). Of 164: 139 predate the rev-4 Stress Protocol
  (`prompt_version` < 0.4.0). The agent contract is at `file-analyser/0.5.0` (current); execution lags
  the contract by ~85%.
- **Layer 3 — reducers.** PRESENT, with stale top-level monoliths + partly-built shards.
  `concepts.yaml`/`implicit-adrs.md`/`doc-gaps.md`/`refactoring-scopes.md`/`test-map.yaml` all dated
  2026-05-19; sharded `*/index.yaml` + `*/detail/` directories built later (2026-05-22). Index/detail
  divergence persists (`test-map`: 908 detail files, two unmerged deltas).
- **Layer 4a — feature-flow-builder.** PRESENT. 31 detail files; `feature-flows/index.yaml`
  `prompt_version: feature-flow-builder/0.4.0-LSN019-canary-B`. Top-level `feature-flows.yaml` is a
  stale frozen monolith (see rank-9 above).
- **Layer 4b — feature-reflector.** BARELY PRESENT. 1 of 31 features reflected. The contract
  (`feature-reflector/0.1.0`) and the `/reflect-feature` skill exist; execution is a single canary.
- **probe-runner.** PRESENT, INCOMPLETE. `runner.py` (2,146 lines) executes probes against a
  docker-compose mirror and the 9 archived runs are real PASS runs with SQL fixtures. The
  `merge_probe_into_sidecars` write-back exists and runs but does not perform the confidence upgrade
  (see rank-1). 85 probe-skeletons in `probes/`; `P-014.yaml:9 status: pending-stress-protocol`.
- **Graph query layer (rev 7).** PRESENT, BUILT. `graph/build-info.yaml`: 3,645 nodes / 4,843 edges,
  `embeddings_available: true`, 4,596 vectors, `BAAI/bge-small-en-v1.5`, built 2026-05-21. ADR
  `graph-query-layer.md` is `status: accepted`. Per the ADR it runs in shadow mode pending the
  maiden gold-set gate; `query-gold-set.yaml` (40 KB) exists. `registry-search` is superseded by the
  semantic `graph-search` dedup (`playbooks/registry-search-spawn.md`). This is the layer the prior
  panel missed entirely — it is real and built.
- **Meta-review (this layer).** Rev-9 single reviewer; first run. The seven `panel-*` agents are
  removed from `.claude/agents/` (confirmed — no `panel-*.md` files). `methodology-reviewer.md` +
  `/panel` skill are present and consistent.

**Summary:** every pipeline stage *exists as specified*; the substrate and three layers (2 / 4b /
probe write-back) are *executing far below their specification*; one layer (graph query) is built
and shadow-gated. The pipeline is not broken — it is under-run.

## gaps

Ranked by evidence-strength × impact. Each is checked against the methodology's own decisions (Rule 2).

1. **The substrate is 14 days and 8 revisions stale, and is the gating dependency for every
   open finding.** Evidence: `manifest.yaml:3 last_scan_date: '2026-05-08'`; revs 2–9 dated
   2026-05-19…2026-05-22. Why it matters: the Stress Protocol backfill, the UI axis, the
   feature-reflector run, the honest-coverage time series — `target.md` conditions 1, 7, 10, 11 —
   all require enrichment on a *current* substrate. Re-enriching a pre-revision substrate produces
   sidecars whose node IDs may not survive the next scan. Checked against: `APPROACH.md` §6 Step 6
   (the cycle starts at substrate scan), `target.md` condition 7 (which already names this exact
   action). Decided, not done — this is condition 7 verbatim, unactioned for a fourth review.
2. **The probe loop does not close the confidence circuit — `stress_answers_probe_verified` is
   structurally pinned at 0.** Evidence: `manifest.yaml:32`; `runner.py:1295` appends a
   `## probe_verifications` note but never rewrites a `confidence:` field; `target.md` condition 6
   requires "a probe-run with `outcome: PASS` mechanically upgrades its originating sidecar's
   confidence to `PROBE-VERIFIED`." Why it matters: the honest-coverage numerator is
   `(STATIC-INFERRED + PROBE-VERIFIED)`; with the second term pinned at 0, the Stress Protocol can
   never graduate a `PROBE-NEEDED` answer, and LSN-019's closure condition (PROBE-VERIFIED ≥ 1) can
   never be met. Checked against: `APPROACH.md` §7 Type-8, §14 "answer forms", `dynamic-verification-layer.md`.
   Decided and *partly built* — the gap is a specific missing step (the confidence rewrite), not the
   whole loop.
3. **The UI-interaction substrate axis — declared MANDATORY by rev 8 — does not exist.** Evidence:
   `manifest.yaml:6-21` lists five axes, none of them the component/form/modal/control tree;
   `APPROACH.md` §0.3 + Rule 18 + §6 Step 3 (rev-8, "exempt from the 3-5 triage") declare it
   mandatory. Why it matters: `target.md` condition 10; and `F-031.yaml`'s wrong `permission_side_door`
   finding — the LSN-023 case — cannot be corrected from a backend-only chain (Rule 18 says so
   explicitly). Checked against: §0.3, Rules 17–19, LSN-023. Decided (rev 8, four days ago), not
   built — the decision is the newest in the methodology and the substrate has not been re-scanned
   since, so this gap was *structurally guaranteed* the moment rev 8 landed without a re-scan.
4. **The rev-4/5 rejection criteria are still prompt-only — `validators.py` does not enforce
   them.** Evidence: `validators.py` checks banned phrases + empty required sections, but has no
   check for empty `stress_findings` on a trigger-bearing node (`APPROACH.md` Rule 13 "IS REJECTED"),
   no missing/zero-hypothesis-reflection check (Rule 15 "rejected at validation"), no numeral-vs-list
   self-consistency check. Live evidence the gap bites: `ActivityHandler.md:32` still says "Three of
   the 27 enum values are NOT covered" then enumerates ~10, in a `confidence: HIGH` sidecar, and the
   count gates a `RuntimeException` at `ActivityServiceImpl.java:263`. Why it matters: the word
   "REJECTED" appears in Rules 13/15/17/18/19 and its only enforcer is the same LLM that under
   context pressure emits the empty block. Checked against: §5 Rules 13/15, `target.md` condition 5.
   Decided, not done — `coherence_sweep.py` + `coverage.py` + `validators.py` exist; the rev-4/5
   rejection checks were never added to any of them.
5. **The feature-reflector covers 1 of 31 features — the senior-product-owner review the platform
   most needs is undeliverable for 97% of features.** Evidence: `feature-reflections/detail/` = 1
   file; `target.md` condition 11. Why it matters: for a UI-driven platform the product-owner review
   is the highest-value maintainer task; the ontology delivers it for one feature. Checked against:
   §15, Rule 15. Decided and *demonstrated working* (the F-021 canary correctly caught the LSN-020
   `userIds` drift) — the gap is purely execution scope. Note: this gap is correctly *downstream* of
   gap 3 — a reflection that reasons from the user's screen needs UI sidecars to trace through.
6. **`F-031.yaml` still carries a confidently-wrong `permission_side_door` finding.** Evidence:
   `feature-flows/detail/F-031.yaml:9,400 drift_class: permission_side_door` for the `namespace_name →
   getOrCreate` chain. The LSN-023 root cause: `getOrCreate` behind a select-or-create combo-box is a
   deliberate UX pattern, not a side-door (Rule 18 + Rule 19). Spot-check SC-2 found the *sibling*
   `CollectorController` sidecar handles the identical `namespaceService.getOrCreate` chain
   *without* the `permission_side_door` label — so the methodology is already internally inconsistent
   about this exact pattern. Why it matters: a wrong HIGH/MEDIUM finding in a shipped artefact is the
   `COVERED-WRONG` class. Checked against: Rules 18–19, LSN-023. Decided (LSN-023 reopened), not
   corrected.

## improvement_proposals

Ranked. Each tagged `add` / `change` / `subtract`.

1. **`subtract` — retire the top-level monolith artefacts (`feature-flows.yaml`, `concepts.yaml`,
   `test-map.yaml`, `implicit-adrs.md`, `doc-gaps.md`, `refactoring-scopes.md`) now that
   `*/index.yaml` + `*/detail/` shards exist.** This is the single highest-leverage subtraction and
   it also kills the prior panel's rank-4 (`test-map` shard) as a *consequence*, not as new work.
   Evidence the monoliths are now pure liability: `feature-flows.yaml` says `total_features: 5` while
   the live count is 31 — it is a stale artefact that *actively misled the prior panel* into a
   `needs_human_verification` item and a contested finding. `test-map/index.yaml` at 1.44 MB is the
   bloat the rev-7 graph query layer was built to retire (this is the exact LSN-024 lesson — do not
   re-propose sharding it; the graph layer already supersedes whole-index loading). The shards are
   built; the monoliths are unsynchronised duplicates. Action: delete the six top-level files,
   leave the `*/index.yaml` thin headline tables + `*/detail/` as canonical, point every reducer +
   the graph projector at the shards. Cost: near-zero, reversible (git).
2. **`change` — make the probe-runner write-back perform the confidence upgrade, not just append a
   note.** `runner.py:1295 merge_probe_into_sidecars` already locates the contributing sidecars and
   edits them; extend it to, on `outcome: PASS`, rewrite the originating `stress_findings` answer's
   `confidence: PROBE-NEEDED` → `PROBE-VERIFIED` and bump `stress_summary.answers_probe_verified`.
   Add one assertion to the probe-runner self-check: "after a PASS run, ≥ 1 sidecar confidence field
   changed." Then re-run the 9 archived PASS probes against the current sidecars. This is the
   minimal, code-anchored fix for the #1 finding of four consecutive reviews.
3. **`add` — extend `validators.py` with the rev-4/5 rejection checks, then wire it into
   `next-batch` Phase 3 before commit.** Three mechanical checks, all non-LLM: (a) empty
   `stress_findings` on a node whose source contains a numeric literal / method-name verb / endpoint
   annotation / `ORDER BY` / `@PreAuthorize`; (b) a feature-flow detail file with no
   `feature-reflections/detail/` counterpart, or a reflection with zero hypotheses; (c) a
   numeral-vs-list-length mismatch inside `stress_findings`/`concepts` (the ActivityHandler class).
   This gives the word "REJECTED" in Rules 13/15/17/18/19 an executor.
4. **`change` — sequence the next milestone as a single end-to-end run on a fresh substrate, in
   this order, and stop revising `APPROACH.md` until it completes.** (i) retire the monoliths
   (proposal 1); (ii) add the `ui-interaction` axis to the extractor + re-scan the substrate;
   (iii) Stress-Protocol-backfill enrichment, sequenced by canonical-bug proximity (`getPopular` —
   the LSN-019 sibling surface — is still on `file-analyser/0.2.0`; backfill it first); (iv) run the
   probe-runner with the fixed write-back; (v) reducers + feature-flow-builder + feature-reflector on
   every feature; (vi) `coherence_sweep.py`; (vii) this review. Record the honest-coverage axes per
   batch. This is `target.md` condition 7 — and it is also the answer to the accretion problem: the
   methodology has enough machinery; it needs one full turn of the crank.
5. **`subtract` — correct or delete the `permission_side_door` drift class from `F-031.yaml`** (and
   audit the sibling `getOrCreate` chains — `CollectorController`, `OwnerController`, F-028 Namespace
   Lifecycle — for the same mislabel). Per Rule 19 the `getOrCreate`-behind-a-combo-box pattern is an
   ADR candidate, not a refactoring-scope side-door. This is a small, bounded correction the
   maintainer can make directly; it removes a known-wrong finding from a shipped artefact.
6. **`change` — sharpen `target.md` condition 1's denominator** (carried forward from both prior
   panels, still unactioned): name `coverage.py`'s `nodes_with_own_sidecar` at the manifest's
   `commit_anchor` as the single denominator of record, and note `ls understanding/` (164) as a
   non-authoritative proxy that counts README/template files. One-line edit; removes a recurring
   measurement ambiguity.

At least one subtraction is present (proposals 1 and 5 are both `subtract`). The methodology's
problem this cycle is not too few mechanisms — it is un-executed mechanisms and stale duplicate
artefacts; the highest-value moves are subtraction and execution, not addition.

## fresh_spot_checks

Four fresh checks, none in `spot-check-ledger.md`. Ground truth established from odd-platform source
@ `ede5d277` (verified `git rev-parse` — the repo is exactly at the commit anchor) BEFORE opening any
ontology artefact.

- **SC-1 — `SearchController.getSearchResults` / `SearchServiceImpl.getSearchResults` —
  search-result pagination + the my-objects empty-result branch.** Ground truth:
  `SearchServiceImpl.java:99-112` — `getSearchResults` fetches the facet state; if `state.isMyObjects()`
  it resolves the associated owner and calls `dataEntityService.findByState(state, page, size, owner)`
  with a `.switchIfEmpty(...)` returning an empty `DataEntityList(List.of(), new PageInfo(0L, false))`;
  otherwise `findByState(state, page, size)`. The my-objects branch silently returns an empty page when
  the caller has no associated owner. Ontology check: there is **no `SearchServiceImpl` sidecar** in
  `understanding/` (the only search sidecars are `SearchController…facets.md`, `…search.md`, and the
  `Search.md` UI component — none covers `getSearchResults` or the service). Verdict: **MISSED-SILENT**
  — a load-bearing capability (paginated search results, the primary discovery surface) with a real
  empty-result boundary is unenriched and threaded by no feature flow.
- **SC-2 — `CollectorController.registerCollector` / `CollectorServiceImpl.create` — the
  `namespace_name` get-or-create on collector registration.** Ground truth:
  `CollectorServiceImpl.java:39-48` — `create` calls `namespaceService.getOrCreate(form.getNamespaceName())`
  when `namespace_name` is non-empty — the *identical* pattern F-031 labels `permission_side_door` for
  the DataSource sibling. Ontology check: `CollectorController…CollectorController.md:42` covers it
  correctly and plainly — "`NamespaceService.getOrCreate(name)` — invoked from create/update when
  `CollectorFormData.namespace_name` is non-empty" — with no `permission_side_door` framing, and the
  sidecar additionally catches the plaintext-token-in-response (`:27`) and destructive-full-replace-update
  (`:66`) behaviours correctly. Verdict: **COVERED-CORRECT** for the collector sidecar — but it
  *exposes an internal inconsistency*: the same `getOrCreate` chain is a neutral dependency here and a
  `permission_side_door` in F-031. The methodology contradicts itself about this exact pattern; gap 6
  is corroborated by this check.
- **SC-3 — `AlertController.changeAlertStatus` — the legal alert-status value set.** Ground truth:
  `AlertController.java:21-27` delegates to `AlertService.updateStatus`; the status enum
  `AlertStatusEnum.java:11-14` has `OPEN`, `RESOLVED`, `RESOLVED_AUTOMATICALLY`. Ontology check:
  `AlertController…changeAlertStatus.md:18` states the body carries "a single `AlertStatus` enum
  value — `OPEN`, `RESOLVED`, or `RESOLVED_AUTOMATICALLY`", `:27` "the set of legal status values is
  closed — only the three enum members", and `:47` correctly identifies the reopen-conflict 400 path
  (`AlertServiceImpl.java:128-129`). Verdict: **COVERED-CORRECT** — enum values, closed-set invariant,
  and the boundary (reopen conflict) all match source.
- **SC-4 — `DataEntityRunController.getRuns`** (the prior panel's SC-5 MISSED-SILENT; re-checked to
  see whether it was actioned). Ground truth: `DataEntityRunServiceImpl` returns HTTP 400 for any
  entity that is not a `DATA_TRANSFORMER` or `DATA_QUALITY_TEST`. Ontology check: still no
  `understanding/` sidecar for `getRuns` (confirmed by `ls understanding/ | grep -i run`). Verdict:
  **MISSED-SILENT** — unchanged from the prior panel; the enrichment frontier did not move here.

Spot-check tally: **2 / 4 COVERED-CORRECT**, 2 MISSED-SILENT, 0 COVERED-WRONG, 0 PARTIAL. Zero
confidently-wrong claims — consistent with the prior two runs; claim *accuracy* where the ontology
has reached remains clean. The two MISSED-SILENT verdicts are both the same structural cause: the
enrichment frontier is 159/395 nodes and neither target node has a sidecar — a breadth gap, not a
correctness gap. (Note: `F-031`'s `permission_side_door` is a known-wrong finding, but it was a
*prior-finding diff item* (gap 6 / rank-6), not a fresh spot-check target, so it is not counted in
this tally — flagged here for honesty.)

## cost

**The methodology's cost trend: RISING but with the corrective now built.** `test-map/index.yaml`
holds at 1.44 MB; `concepts.yaml` at 647 KB; six stale top-level monoliths duplicate content their
shards now hold — proposal 1's subtraction removes this class at near-zero cost. The structural fix
for the bloat — the rev-7 graph query layer — is built and shadow-gated; the cost problem is no
longer "no solution exists" (the prior panels' framing) but "the monoliths were not retired after
the solution shipped." Per-verified-claim cost stays poor while `probe_verified` = 0: tokens spent
enriching a pre-Stress-Protocol sidecar add nothing to the honest denominator.

**This review's own cost: ~95k tokens** — one `methodology-reviewer` agent, one pass, ~40 tool
calls (Read/Bash/Grep). Against the rev-8 lite panel's measured ~480k and the full panel's ~1.4M,
that is a ~5× and ~14× reduction respectively — the rev-9 cost claim ("roughly one-seventh") is in
range and is the first measurement of it. As a fraction of the ~3.5M-token ontology investment the
prior panel cited, this review is ~2.7%. Rev-9 itself is the cost subtraction the methodology
needed; LSN-024 is, on this evidence, correctly closed by this run (it traced the whole current
methodology including rev-7 and rev-9, and produced a `what_changed` diff rather than re-listing —
its closure condition).

## correlated_blind_spot_caveat

This review is a Claude-family agent auditing artefacts built by Claude-family agents. The
correlated-blind-spot risk is HIGH and not removable in-harness (`APPROACH.md` §16.3). Every finding
above is weighted by cited evidence — a `file:line`, a `wc -c`, a `grep` count, a `git log` — never
by the reviewer's confidence; a correlated model cannot make a failing count pass. The maintainer's
own spot-audit remains the one genuinely independent oracle. Two specific cautions for this run:
(1) this is the *first* run of the rev-9 single-reviewer format — there is no second agent and no
cross-examination, so a blind spot in this reviewer's reading of the methodology is uncaught by
construction; the prior six-agent panel's one real benefit (six independent passes) is gone, traded
for ~5–14× lower cost — the trade is sound but it is a trade. (2) The probe-runner write-back finding
(gap 2 / rank-1) was *corrected* this run versus the prior panel — the prior panel said the code
"does not execute"; this run found it does execute but does not perform the confidence upgrade. That
correction rests on reading `runner.py` statically; whether the called `merge_probe_into_sidecars`
*fully* behaves as the static read suggests on a live PASS run is the kind of thing only an actual
run confirms.

needs_human_verification:
- "Gap 2 / rank-1 — confirm by running the probe-runner on one PASS probe against a current sidecar
  whether `merge_probe_into_sidecars` does in fact only append a note and never rewrites a
  `confidence:` field. The static read of `runner.py:1295-1410` supports this, but a live run is the
  authoritative check, and the fix in proposal 2 depends on the exact current behaviour."
- "Gap 3 / rank-10 — confirm the maintainer's intended timing for the `ui-interaction` substrate
  axis: rev 8 declared it mandatory four days ago; the substrate has not been re-scanned since.
  Is the axis blocked on the extractor work, or simply not yet sequenced?"
- "Proposal 1 — confirm the `*/index.yaml` + `*/detail/` shards are complete and authoritative
  enough to retire the six top-level monoliths, i.e. that no reducer or skill still reads a
  top-level monolith as its source. A grep of the agent contracts + skills for the monolith
  filenames before deletion is the safe check."
- "Gap 6 / proposal 5 — confirm the `permission_side_door` finding in `F-031.yaml` is acknowledged
  as wrong (LSN-023's named artefact) and should be corrected/deleted, and decide whether the
  sibling `getOrCreate` chains (CollectorController, OwnerController, F-028) need the same audit."
- "rank-5 / ENG-F3 carried forward — a maintainer should personally count the ActivityEventTypeDto
  handler coverage; `ActivityHandler.md:32` says 'Three of the 27' then lists ~10, and the true
  uncovered count gates a `RuntimeException` at `ActivityServiceImpl.java:263`."
- "The maiden acceptance gate — `meta-reviews/validation/` holds only a README; `gold-set.yaml`
  and `seeded-corpus/` do not exist. Until the maintainer authors them and `/panel validate`
  passes, this review (like every prior one) is `pre-acceptance-gate` and its findings are
  provisional. No agent can author the corpus — it is the external oracle, by design."
