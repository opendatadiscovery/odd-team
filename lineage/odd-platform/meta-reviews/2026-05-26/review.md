---
review_run: 2026-05-26
commit_anchor: ede5d277
prior_review: 2026-05-22
verdict: changes-needed
validation_status: pre-acceptance-gate
review_cost_estimate: ~85k tokens (one agent, one pass)
---

# Methodology review — 2026-05-26

This is the second run of the rev-9 single `methodology-reviewer`. The prior review is
`meta-reviews/2026-05-22/review.md`. Between the two reviews the maintainer ran nine batches
(ZD–ZL) end-to-end on a "sprint-finalize" branch — `git log` since `27be3da` shows
`+50 sidecars / +11 features / 9 [next-batch] done` commits, closing a one-week sprint at the
recorded "97.7% effective coverage" mark.

## verdict

**changes-needed.** The architecture is still sound and the sprint produced real, citeable
work — coverage moved 159 → 209 sidecars, 31 → 43 features, and one truly UI-anchored
sidecar (`NamespaceAutocomplete.md`, `prompt_version: 0.5.0`) explicitly cites LSN-023 and
gives the methodology its first correct read of the select-or-create combo-box pattern.
But every load-bearing finding the last four reviews raised is still standing in artefact
form: **the substrate is unchanged (5 axes, no `ui-interaction`, `last_scan_date:
2026-05-08`)** (`manifest.yaml:3,6-21`); **the probe loop still does not flip a single
sidecar's confidence** (`manifest.yaml:32 stress_answers_probe_verified: 0`); **the
feature-reflector still covers 1 of 43 features** (`feature-reflections/detail/` = 1 file
against 43 in `feature-flows/detail/`); **the `permission_side_door`-class drift is still
shipped — and is now contradicted by the methodology's own UI sidecar** (`F-031.yaml:9,400`
+ `F-019.yaml:415` vs `NamespaceAutocomplete.md` lines 16-37 + LSN-023). The single most
important thing this cycle is not another revision and not another batch — it is to take
the *one* artefact whose error-class four reviews have named and *delete the wrong claim*,
then re-scan the substrate with the rev-8 UI-interaction axis declared. Until those two
moves land, every batch enriches a pre-revision substrate, and every closed LSN remains
closed-by-narrative.

## what_changed_since_last_review

The prior review raised 6 gaps + 6 proposals (2 subtractions) + 5 needs_human_verification
items. Diffed against current artefact state at `ede5d277`:

- **Gap 1 — substrate 14d / 8 revisions stale, root-blocker.** `unactioned`. `manifest.yaml:3
  last_scan_date: '2026-05-08'` byte-identical; node/edge files mtimes still `2026-05-18`
  (the rebuild from the rev-7 graph-query branch, not a substrate scan); `nodes.jsonl`
  axes are still the five originals (`grep -o '"axis": "[^"]*"' nodes.jsonl | sort -u` = 5
  values). The sprint added 50 sidecars on top of the unchanged substrate.
- **Gap 2 — probe loop does not close the confidence circuit.** `unactioned`.
  `manifest.yaml:32 stress_answers_probe_verified: 0` byte-identical;
  `runner.py:1295-1410` is verbatim the same `merge_probe_into_sidecars` from last review —
  it appends a `## probe_verifications` note, never rewrites a `confidence:` field.
  The `needs_human_verification` item from the prior review (NHV-1, "live-run check") was
  not retired — no probe ran against a current sidecar this cycle.
- **Gap 3 — UI-interaction substrate axis declared mandatory by rev 8 / Rule 18 is
  absent.** `partial — sidecar-level workaround, substrate-level still absent`. The
  substrate manifest still declares only the five original axes. BUT: sidecars are using
  ~29 informally-invented axis labels (`grep -h '^axis:' understanding/*.md | sort -u | wc
  -l` = 29) — `ui-components`, `react-components`, `react-component`, `ui_components`,
  `auth-handlers` AND a duplicate `auth_handlers`, `notification.processor`, `housekeeping`,
  `jotai-store`, `services`, `repositories`, `filters`. The UI surface IS being enriched
  (e.g. `NamespaceAutocomplete.md`, `LookupTables.md`) — but as a free-form sidecar axis
  the substrate does not know about. Per `APPROACH.md` Rule 18 the UI axis is mandatory in
  the SUBSTRATE; the workaround is the sidecar emitting `axis: ui-components` and hoping
  the next scan canonises it. So Rule 18's letter is unmet; its spirit (the UI is now
  enriched) is partially met. This is a *new structural finding*: the sidecar↔substrate
  axis contract has drifted, with 29 distinct labels including casing/spelling variants.
- **Gap 4 — `validators.py` does not enforce rev-4/5 rejection criteria.** `unactioned`.
  `validators.py` (272 lines, unchanged this cycle) still checks frontmatter + section
  presence + banned phrases; `grep -n 'stress_findings\|reflection\|hypothes\|triggers_total'
  validators.py` = empty. The word "REJECTED" in APPROACH.md Rules 13/15/17/18/19 still
  has no executor outside the LLM that emits the sidecar.
- **Gap 5 — feature-reflector covers 1/31 (now 1/43).** `unactioned, worsening in
  ratio`. `ls feature-reflections/detail/` = 1 file (`F-021.yaml`). Denominator went from
  31 → 43 features; reflection coverage went from 3.2% → 2.3%. The sprint added 12
  features and zero reflections.
- **Gap 6 — `F-031.yaml` carries a confidently-wrong `permission_side_door` finding.**
  `unactioned — and is now self-contradicted by the methodology`. `F-031.yaml:9 - permission_side_door`
  and `:400 drift_class: permission_side_door` are byte-identical to last review. Worse:
  `F-019.yaml:415` carries `owner_create_permission_side_door_via_getorcreate_three_service_tier_callsites`
  — the same class extended to a sibling chain. Meanwhile the maintainer-directed
  `NamespaceAutocomplete.md` sidecar (the LSN-023 corrective enrichment, `prompt_version:
  0.5.0`) reads at lines 16-37: *"the create row is the no-match fallback, explicitly
  labelled… LSN-023 records that this component's backend was previously mis-read, from a
  backend-only chain, as a 'permission side-door' — the present sidecar is the UI-side
  evidence that it is a deliberate, labelled UX affordance."* The methodology has authored
  the correction and explicitly cited the wrong artefact — and the wrong artefact still
  ships. The internal contradiction is now mechanically detectable.

**Prior proposals diff:**
- P-1 (retire 6 top-level monoliths): `partial — 2 of 6 retired-de-facto`. The reducers
  now write to `*/detail/` + `*/index.yaml` for `feature-flows` (43 detail / 36KB
  monolith), `implicit-adrs` (287 detail / 459KB monolith / 399KB index), `refactoring-scopes`
  (709 detail / 546KB monolith), `doc-gaps` (360 detail / 292KB monolith), `test-map`
  (1038 detail / 785KB monolith / **1.69MB index**), `concepts` (553 detail across 5 sub-
  directories / 647KB monolith / 470KB index). The 6 stale top-level files still exist;
  `feature-flows.yaml` still says `total_features: 5` (line 7) while the live `index.yaml`
  says 30 and `detail/` has 43. The `index.yaml` shards themselves are growing: `test-map/
  index.yaml` is **1.69MB** — LARGER than the panel-era 1.44MB monolith the rev-7 graph
  query layer was built to retire (panel-era 1.26MB → prior-review 1.44MB → current
  **1.69MB**). Subtraction did not happen; the shard's index inherited the monolith's
  bloat shape.
- P-2 (probe-runner write-back performs confidence upgrade): `unactioned`. See Gap 2.
- P-3 (add rev-4/5 rejection checks to validators.py): `unactioned`. See Gap 4.
- P-4 (sequence a single end-to-end run on a fresh substrate, stop revising APPROACH.md):
  `partial — the sprint ran 9 batches but on the un-rescanned substrate`. The maintainer
  did NOT continue revising APPROACH.md during the sprint (good — the 9 commits are all
  `[next-batch]` themes); but the substrate was not re-scanned with the rev-8 UI axis
  before the batches began. The `97.7% effective coverage` claim in the finalize commit is
  not the honest stress-verified axis (`stress_verified_pct: 89.8` per `manifest.yaml:35`
  is the static axis; probe_verified remains 0).
- P-5 (correct or delete `permission_side_door` from F-031): `unactioned`. See Gap 6.
- P-6 (sharpen `target.md` condition 1 denominator): `unactioned`. `target.md:24` is
  byte-identical to last review.

**needs_human_verification status from prior review:**
- NHV-1 (live probe-runner check of write-back): not retired — no probe ran.
- NHV-2 (UI axis timing): the sprint produced UI sidecars under informal axis labels
  without a substrate re-scan; the maintainer's answer is implicit in the artefacts —
  *enrich first, formalise the axis later*. That answers the question but it conflicts
  with Rule 18's "mandatory substrate axis" — see Gap 3.
- NHV-3 (shard authoritativeness for monolith deletion): partially answered by
  `b8c5dd1 [methodology] drop index maintenance from /next-batch — graph-search + detail/
  are canonical post rev-7.1` — the reducers now treat `detail/` as canonical, the index
  is a side-product. So monolith deletion is unblocked.
- NHV-4 (F-031 permission_side_door correction): unactioned.
- NHV-5 (ActivityHandler 27-enum numeral-vs-list count): `ActivityHandler.md:32` still
  reads "Three of the 27 enum values are NOT covered" followed by a list of ~10. Same
  defect.

**Net:** of 6 prior gaps — 0 fixed, 1 partial (Gap 3, with a structural complication),
5 unactioned. Of 6 prior proposals — 0 done, 1 partial (P-4), 5 unactioned. The trend the
last four reviews reported (top findings not driving fixes) holds for a fifth review.

## pipeline_trace

End-to-end trace at `ede5d277`, with what `APPROACH.md` says each stage should be:

- **Substrate (Layer 1).** PRESENT, **UNCHANGED**. `manifest.yaml:3 last_scan_date:
  '2026-05-08'`. 395 nodes / 479 edges; `nodes.jsonl` axes = `config_prefixes (96),
  controllers (239), openapi_tags (35), ui_routes (12), ui_shell (13)`. **The substrate
  has not been re-scanned through revs 2-9.** §0.3 + Rule 18 + §6 Step 3 declare a UI-
  interaction axis mandatory — still absent. The sidecars worked around it by inventing
  `ui-components` / `react-components` / `react-component` / `ui_components` as four
  variant axis labels — see Gap 3.
- **Layer 0 — domain-extractor.** PRESENT, STABLE. `system-mission.md` (55KB, dated
  2026-05-20). Not re-run since; acceptable per §13 cadence (once per substrate scan, and
  the substrate hasn't been re-scanned).
- **Layer 2 — file-analyser enrichment.** PARTIAL, BROADER. 212 sidecar files (159 in
  prior review → +53; `manifest.yaml:26 nodes_with_own_sidecar: 209` — 3 of 212 are
  README/template). `prompt_version` distribution: `0.1.0 (12), 0.2.0 (86), 0.3.0 (39),
  0.4.0 (48), 0.5.0 (27)`. **137 of 212 sidecars predate Stress Protocol (rev 4 =
  0.4.0); 75 of 212 carry a `stress_findings` block** (`manifest.yaml:37
  sidecars_with_stress_section: 75`). The agent contract is at `file-analyser/0.5.0`;
  execution lags the contract on 65% of sidecars. The stress section, where it exists, is
  high-quality — `LookupTables.md` and `NamespaceAutocomplete.md` are case examples of
  the rev-5 protocol in action. The Stress Protocol's `stress_questions_total: 1946` is
  a real number; `stress_answers_probe_verified: 0` is the persistent unclosed circuit.
- **Layer 3 — reducers.** PRESENT, sharded `*/detail/` + `*/index.yaml` are the
  authoritative form (`b8c5dd1`); top-level monoliths are stale duplicates. `test-map/
  index.yaml` (1.69MB) is **larger than the rev-7-trigger 1.26MB monolith** — the
  bloat shape moved one directory down rather than being retired.
- **Layer 4a — feature-flow-builder.** PRESENT, GROWING. 43 detail files (vs prior 31);
  `feature-flows/index.yaml prompt_version: feature-flow-builder/0.4.0-LSN019-canary-B`.
  Top-level `feature-flows.yaml` (36KB) still reports `total_features: 5` at line 7 —
  unchanged stale monolith.
- **Layer 4b — feature-reflector.** BARELY PRESENT. 1 of 43 features reflected
  (`feature-reflections/detail/F-021.yaml`). The reflection itself is substantive — 14
  hypotheses, 9 contradicted, 2 confirmed, 2 partial, 1 probe-needed; HIGH-severity
  finding on the `userIds → OWNER_ID` drift cited (`F-021.yaml:30-31`). Layer 4b works
  when fired; the gap is purely execution scope.
- **probe-runner.** PRESENT, INCOMPLETE. `runner.py` (2,146 lines) executes probes; 11
  sidecars carry `## probe_verifications` (the note-append). 165 probe-skeletons under
  `probes/`; 9 archived `probe-runs/2026-05-19-P-00*.yaml` (no newer runs). The
  `merge_probe_into_sidecars` write-back exists and APPENDS notes; it does NOT rewrite
  `confidence:` — verified by static read of `runner.py:1295-1410` and by `grep -c
  'confidence: PROBE-VERIFIED' understanding/*.md` = 3 (all confidence_per_field lines
  describing a future flip, none of them an actual flipped trigger answer).
- **Graph query layer (rev 7).** PRESENT, BUILT, REBUILT. `graph/build-info.yaml`:
  4,504 nodes / 6,172 edges / 5,797 vectors / `BAAI/bge-small-en-v1.5` / `built_at:
  2026-05-26` (cache hit rate 98.3%). Labels: `Sidecar: 208 / CodeNode: 776 / Feature: 43
  / FeatureReflection: 1`. ADR `graph-query-layer.md` is `accepted`. ADR
  `agentic-graph-retriever.md` is `accepted`. `registry-search` superseded by semantic
  `graph-search` (`playbooks/registry-search-spawn.md` rev-7.1).
- **Meta-review (this layer).** Rev-9 second run. Prior review file present. `panel-*`
  agents absent (confirmed — `.claude/agents/` has no `panel-*.md`). The
  `methodology-reviewer` contract + `/panel` skill remain consistent.

**Summary:** the *pipeline definition* is at rev 9; the *pipeline execution* is at a state
that broadly tracks prior-review numbers + the sprint's +50/+11 batch deltas. Substrate
and probe-write-back are unchanged from prior review; reducer shards exist alongside the
unretired monoliths; the UI surface IS being enriched at the sidecar layer but the
substrate axis is still absent. The pipeline is not broken — it is being run *around* the
two structural blockers (substrate re-scan + probe write-back) rather than through them.

## gaps

Ranked by evidence-strength × impact. Each is checked against the methodology's own
decisions (Rule 2). All of gap 1, 2, 4 and parts of 3, 5, 6 are unchanged restatements
of prior findings — see `what_changed_since_last_review` above; they are listed here
because they are still the load-bearing structural deficiencies, and the second time a
review repeats a gap, what changes is the proposal's framing, not the gap itself.

1. **The methodology is internally contradicting itself about `permission_side_door`.**
   This is the new, mechanically-detectable form of prior Gap 6 — what was a single
   wrong artefact is now a *contradiction*. Evidence: `NamespaceAutocomplete.md:16-37`
   (`prompt_version: file-analyser/0.5.0`, the LSN-023 corrective enrichment) reads:
   "*the create row is the no-match fallback, explicitly labelled… LSN-023 records that
   this component's backend was previously mis-read, from a backend-only chain, as a
   'permission side-door' — the present sidecar is the UI-side evidence that it is a
   deliberate, labelled UX affordance.*" Meanwhile `F-031.yaml:9,400` carries
   `drift_class: permission_side_door` for the `namespace_name → getOrCreate` chain
   verbatim, and `F-019.yaml:415` extends it to the Owner chain as
   `owner_create_permission_side_door_via_getorcreate_three_service_tier_callsites`. Two
   artefacts under the same methodology, anchored on the same source files, the UI
   sidecar correctly cites the feature flow as wrong, and the feature flow still ships
   its wrong claim. Why it matters: this is COVERED-WRONG at the feature-flow level
   contradicted by COVERED-CORRECT at the UI-sidecar level — the methodology can detect
   this with a single `graph-search --label Feature 'permission_side_door'` joined
   against any sidecar citing LSN-023. Checked against: APPROACH.md Rule 18, Rule 19,
   LSN-023 (status: open), `feature-anchored-ontology.md`. Decided (LSN-023 reopened),
   *partly corrected at the sidecar layer*, **not propagated to the feature flow**.

2. **The substrate is 18 days / 8 revisions / 1 sprint stale.** Evidence: `manifest.yaml:3
   last_scan_date: '2026-05-08'` unchanged from prior review; `nodes.jsonl` mtime
   2026-05-18; axis count still 5 (no `ui-interaction`). Sprint added 50 sidecars (159 →
   209) *on top of* the unchanged substrate. Why it matters: substrate freshness is the
   gating dependency for `target.md` conditions 1, 7, 10, 11. Sidecars are now using ~29
   distinct axis labels including informally-added UI variants (Gap 3) that the substrate
   does not declare. Re-enriching a pre-revision substrate produces sidecars whose
   node-id stability is not guaranteed against the next scan. Checked against:
   APPROACH.md §6 Step 6, Rule 18, target.md condition 7. Decided, not done — unactioned
   for a fifth review.

3. **The sidecar↔substrate axis contract has drifted into 29 distinct labels.** This is
   a *new* structural finding surfaced this review and is the form Gap 2's
   "UI-interaction axis absent" took during the sprint. Evidence: `grep -h '^axis:'
   understanding/*.md | sort -u | wc -l` = **29**. Variants include `react-component` /
   `react-components` / `ui-components` / `ui_components` (four spellings of "UI
   component"); `auth-handlers` / `auth_handlers` (dash vs underscore); plus invented
   axes the substrate manifest does not declare — `services`, `repositories`,
   `notification.processor`, `housekeeping`, `jotai-store`, `filters`, `config-properties`
   (alongside the manifest's `config_prefixes`). Why it matters: the substrate axis set
   (`manifest.yaml:6-21` = 5 axes) is supposed to be the single source of node-kind
   taxonomy that the reducers, graph projector, and coverage script all join on. With 29
   sidecar-level axes the projector silently de-dups some and segregates others (the
   `auth-handlers` / `auth_handlers` pair is two clusters with one meaning), the
   `nodes_touched_by_any_feature_flow: 386` denominator is computed against the manifest
   axes only, and `coverage.py` cannot honestly report "X% of nodes on the UI axis are
   enriched" because there is no UI axis in the manifest. Checked against: APPROACH.md
   §4.1 (node kinds), §4.2 (edge types), §6 Step 3 (project-specific axes), Rule 18.
   Decided (rev 8 mandated the substrate axis), not done — but the sidecars went ahead
   and added the axis under inconsistent labels, which is now its own gap.

4. **The probe loop does not flip a single sidecar's confidence — the honest-coverage
   axis cannot graduate `PROBE-NEEDED` answers.** Evidence: `manifest.yaml:32
   stress_answers_probe_verified: 0` unchanged; `runner.py:1295-1410` static-read
   confirms the merge function appends a `## probe_verifications` note and never
   rewrites a `confidence:` field; `grep -rl '## probe_verifications' understanding/`
   = 11 sidecars carry the note. Why it matters: `target.md` condition 6 requires "a
   probe-run with `outcome: PASS` mechanically upgrades its originating sidecar's
   confidence to `PROBE-VERIFIED`." Without that, `stress_answers_probe_needed: 130` can
   only ever shrink by another static-trace pass, never by an actual measurement; LSN-019
   cannot reach its closure condition. Checked against: APPROACH.md §7 Type-8, §14
   "answer forms", target.md condition 6. Decided and partly built — the merge call exists
   and runs; the specific confidence-rewrite line of code is the missing piece.

5. **Rev-4/5 rejection criteria are still prompt-only — `validators.py` has no executor
   for the word "REJECTED".** Evidence: `validators.py` (272 lines, unchanged) checks
   frontmatter + section presence + banned phrases; `grep -n 'stress_findings\|reflection\|
   hypothes\|triggers_total' validators.py` = empty. Live evidence the gap bites: the
   ActivityHandler `Three of the 27 / list-of-10` count contradiction is **identical**
   to prior review — same line, same defect; the F-031/F-019 `permission_side_door`
   contradiction (Gap 1) is detectable in artefact form but has no validator firing.
   Why it matters: Rules 13/15/17/18/19 each contain the word "REJECTED" and the only
   enforcer is the LLM that under context pressure can author the rejection condition
   into a sidecar. Checked against: APPROACH.md §5 Rules 13/15/17/18/19, target.md
   condition 5. Decided, not done.

6. **The feature-reflector covers 1 of 43 features (2.3%) — the senior-product-owner
   review the platform most needs is undeliverable for 97.7% of features.** Evidence:
   `feature-reflections/detail/` = 1 file (F-021.yaml). Denominator went 31 → 43 features
   this sprint; reflection coverage 3.2% → 2.3% (relative decrease). The one extant
   reflection (`F-021.yaml`) is substantive: 14 hypotheses, 9 contradicted, 2 confirmed,
   2 partial, 1 probe-needed; HIGH-severity finding on the LSN-020 drift cited explicitly
   (`hypothesis_summary.highest_severity_contradiction: H-001`). Why it matters: the
   reflection layer is the methodology's strongest correctness check — every feature run
   through it found drift; running it on 2.3% of features is leaving 95% of the
   methodology's strongest signal unfired. Checked against: APPROACH.md §15, Rule 15,
   target.md condition 11. Decided and demonstrated; gap is execution scope (downstream
   of Gaps 2 + 3 — reflections that reason from the user's screen need UI sidecars to
   trace through, which now exist piecemeal under informal axes).

## improvement_proposals

Ranked. Each tagged `add` / `change` / `subtract`. The proposals all subordinate to one
single move — "stop revising, run the methodology end-to-end on a fresh substrate" — which
the prior review's P-4 already named and which is *partially* done (the sprint executed,
the substrate did not re-scan). What changes this cycle is the *order* of the operations,
and one new mechanical subtraction the artefact-level contradiction (Gap 1) enables.

1. **`subtract` — delete `drift_class: permission_side_door` from `F-031.yaml` lines 9 +
   400, and `owner_create_permission_side_door_via_getorcreate_…` from `F-019.yaml:415`.**
   This is a near-zero-cost, reversible, *mechanically validated* subtraction: the
   methodology's own `NamespaceAutocomplete.md:16-37` cites these artefacts as the wrong
   reading; LSN-023 is open; Rule 18 says explicitly that a `permission_side_door`-class
   finding minted from a backend-only chain is a defect. The maintainer can do this
   directly without a re-scan. Action: delete the two drift_class entries; replace with
   a one-line note pointing at `NamespaceAutocomplete.md` and LSN-023; the audit trail
   survives in git. This removes the most concrete known-wrong claim from a shipped
   artefact AND retires Gap 1 as a structural issue.

2. **`add` then `change` — declare the `ui-interaction` axis in the substrate extractor,
   re-scan, and migrate the ~50 sidecars currently using the four UI-variant labels
   (`ui-components`, `ui_components`, `react-component`, `react-components`) onto the
   canonical `ui-interaction` axis.** This closes Gap 2 (substrate stale), Gap 3 (29
   axis labels) AND most of Rule 18's letter in one move. Sequence: (i) one Python
   change to the extractor declaring the axis + the tree-sitter pattern for React
   functional components / forms / modals; (ii) `python lineage/_extractor/.../substrate
   scan --full`; (iii) one batch reducer that re-keys every existing sidecar's
   `axis:` field to the canonical name (the `node_id` stable join key is on the
   manifest's `node_id`, not on `axis:`, so re-keying is a YAML-frontmatter edit not a
   re-enrichment). Note: this is what prior review P-4 step (ii) already specified —
   re-listed here because the sprint deferred it. The 29-distinct-labels finding (Gap 3)
   means there is *more* clean-up to do than P-4 anticipated.

3. **`change` — make `merge_probe_into_sidecars` perform the confidence upgrade.**
   `runner.py:1295` already opens the sidecar, locates the contributing chain, and edits.
   Extend it: on `outcome: PASS`, locate the originating `stress_findings` answer
   (`probe_id == run.probe_id`), rewrite `confidence: PROBE-NEEDED → PROBE-VERIFIED`,
   bump `stress_summary.answers_probe_verified`. Add one assertion to the
   runner's self-check: "after a PASS run, ≥ 1 sidecar `confidence:` field changed." Then
   re-run the 9 archived PASS probes against current sidecars to retire `probe_verified
   = 0`. **This is the minimal code-anchored fix for the #1 finding of five consecutive
   reviews** — the prior review labelled it P-2 and it is unchanged.

4. **`subtract` — delete the six stale top-level monoliths now that `b8c5dd1` confirmed
   `detail/` is canonical.** `feature-flows.yaml` (36KB; says `total_features: 5`
   against live 43), `concepts.yaml` (647KB), `test-map.yaml` (785KB), `implicit-adrs.md`
   (459KB), `doc-gaps.md` (292KB), `refactoring-scopes.md` (546KB) — total 2.66MB of
   stale duplicate content. NHV-3 from prior review answered the safety check
   (`b8c5dd1` made `*/detail/` canonical); the only remaining risk is a downstream
   consumer reading the monolith — `grep -rln 'feature-flows.yaml\|test-map.yaml' .claude/
   playbooks/ adrs/ lineage/_extractor/` before deletion is the safe check. Sub-action:
   `test-map/index.yaml` itself is **1.69MB** (the index shard is now larger than the
   panel-era 1.44MB monolith); the shard's index needs an `index/by-feature/` sub-shard
   OR the projector + graph-search become the consumer of record and the index becomes a
   thin headline file. The rev-7 graph query layer already implements that pathway.

5. **`add` — extend `validators.py` with three rev-4/5 rejection checks AND one
   contradiction check, then wire it into `next-batch` Phase 3 before commit.** Same
   three mechanical checks the prior review named (empty `stress_findings` on a
   trigger-bearing node; feature-flow detail without a reflection counterpart; numeral-
   vs-list-length mismatch) PLUS one new check the artefact-level contradiction (Gap 1)
   enables: *if any sidecar carries `LSN-023` as a citation AND any feature-flow detail
   file carries `permission_side_door`, the validator emits a contradiction error
   pointing at both filenames.* This gives the word "REJECTED" an executor AND mechanises
   the "do not re-emit the LSN-023 mistake" rule. Cost is one Python file extension.

6. **`subtract` — pause Layer 4b execution scope expansion until Gap 2 + Gap 3 are
   resolved.** This is a counter-intuitive subtraction: do NOT chase Gap 6 (reflection
   coverage 2.3%) directly by running 42 reflections this week. The reflections that
   reason from the user's screen need the UI sidecars to trace through; the UI sidecars
   are currently scattered across four informal axis variants on a stale substrate.
   Running 42 reflections on the *current* artefact state would either (a) emit a
   `permission_side_door`-class contradiction for each `getOrCreate` chain (the
   methodology would amplify Gap 1) or (b) terminate at backend-only chains for the UI
   subset, producing 42 `ui-incomplete` reflections. Order: substrate re-scan → axis
   canonicalisation → reflection sweep. Stated as a positive: **finish proposals 2 + 3 +
   1 first, then reflect on every feature in one pass.**

At least one subtraction is present (proposals 1, 4, 6 are `subtract`). The methodology's
problem this cycle is not too few mechanisms — it is **two unactioned mechanical fixes**
(probe write-back, substrate re-scan) and **one shipped artefact-level contradiction** that
the maintainer can correct in three minutes.

## fresh_spot_checks

Four fresh checks, none in `spot-check-ledger.md`. Ground truth established from
odd-platform source @ `ede5d277` (verified `git rev-parse` — the repo is exactly at the
commit anchor) BEFORE opening any ontology artefact.

- **SC-1 — `LookupTableForm.tsx` — the Edit-form DTO drift.** Ground truth:
  `LookupTableForm.tsx:49` types the form data as `LookupTableFormData` (the CREATE
  shape with `namespaceName`); `LookupTableForm.tsx:60-66` submits the SAME shape to
  `editLookupTable({ lookupTableUpdateFormData: data, ... })`. Reading the generated
  OpenAPI: `LookupTableUpdateFormData` defines only `name` + `description` (per the
  generated-sources type). The form UI disables the namespace field on edit
  (`disabled={!!lookupTable}` line 120), but still submits it in the request body. The
  server silently discards it. Ontology check: there is no `LookupTableForm.tsx`
  standalone sidecar (`ls understanding/ | grep -i 'LookupTableForm'` = none); the
  pattern is covered indirectly by `LookupTables.md` which IS the canonical landing for
  the pillar (`prompt_version: 0.4.0`). That sidecar at `LookupTables.md:118` reads:
  *"Edit-form DTO drift: `LookupTableForm.tsx:49` types form data as `LookupTableFormData`
  (the CREATE shape with required `namespaceName`). On edit (line 60-66), it submits the
  SAME shape… The `namespace_name` field is sent on the wire on every edit but silently
  discarded by the server… The form-visual `disabled={!!lookupTable}` (line 120) hides
  this from the user. — severity: HIGH"*. Verdict: **COVERED-CORRECT** — the wider sidecar
  catches the form-level bug, with file:line evidence, and at HIGH severity. The form
  having no standalone sidecar is acceptable because the parent component sidecar covers
  it explicitly with cross-references.
- **SC-2 — `DirectoryController.getDatasourceEntities` — page-vs-count predicate
  divergence on the Directory level-4 endpoint.** Ground truth:
  `DirectoryController.java:37-44` delegates to
  `dataEntityService.getDataEntitiesByDatasourceAndType(dataSourceId, typeId, page, size)`.
  Reading down the chain to the repository (mentioned in the sidecar): the
  `listByDatasourceAndType` and `countByDatasourceAndType` SQL pair may use different
  predicates. Ontology check: `DirectoryController.md:22` reads *"this sidecar surfaces a
  STRUCTURALLY SIMILAR page-vs-count predicate divergence in
  DataEntityRepository.listByDatasourceAndType vs countByDatasourceAndType consumed at
  getDatasourceEntities (level 4) — filed as REFACTOR-NEW"* — the sidecar identifies the
  exact endpoint and the exact repository methods, classifies the issue, and files a
  refactor candidate. `DirectoryController.md:100-104` then names *"target:
  getDatasourceEntities (Directory level 4)"* under `coherence_check.strengthens`.
  Verdict: **COVERED-CORRECT** — the structural finding is named, traced to the repo
  layer, and explicitly differentiated from the sibling `listDto` divergence.
- **SC-3 — `TermController` — the surface count of operations the controller exposes
  (terms + linkage + ownership + tags + query-examples).** Ground truth:
  `TermController.java:42-72` declares six injected services
  (`TermService, DataEntityService, DatasetFieldService, TermSearchService,
  TermOwnershipService, QueryExampleService`) and the file body implements a mix of
  `getTermsList / getTermDetails / createTerm / updateTerm / deleteTerm` (term lifecycle)
  plus owner/tag/queryExample-linkage methods. Ontology check: `TermController.md`
  (controller-class sidecar) exists at `understanding/odd-platform__java__TermController__
  controller-class__TermController.md`; one controller-method sidecar exists for
  `createTermTagsRelations`. Verdict: **PARTIAL** — controller-class is covered, but
  only 1 of N controller-methods has a method-level sidecar; the methodology
  acknowledges this in the related_sidecars block of the class file. This is the
  enrichment-frontier breadth gap (159/395 → 209/395) showing up at a specific surface,
  not a correctness defect.
- **SC-4 — `NamespaceAutocomplete.tsx` — the select-or-create UX pattern's coverage in
  the feature-flows where it is consumed.** Ground truth: `NamespaceAutocomplete.tsx`
  (the file, not the sidecar) is the select-or-create combo-box; per its imports it is
  consumed by the DataSource form (F-031 chain), the Term form, the LookupTable form
  (F-026 / F-026:LookupTables), the DataEntityGroup form, and the Collector form (F-019
  related). Ontology check: `NamespaceAutocomplete.md` (the sidecar) exists, is at
  `prompt_version: file-analyser/0.5.0`, correctly understands the pattern, and
  *explicitly cites LSN-023 and the wrong `permission_side_door` reading at lines 16-37*.
  But: `grep -l 'NamespaceAutocomplete' feature-flows/detail/*.yaml` = empty — **the
  five feature flows that consume NamespaceAutocomplete do NOT cite the UI sidecar in
  their `contributing_nodes`.** Verdict: **COVERED-CORRECT (sidecar) + MISSED-SILENT
  (linkage)** — the corrective sidecar exists; the feature flows it should correct have
  not been re-built to consume it. This is the artefact-level proof of Gap 1: the
  methodology authored the correction at one layer, did not propagate it to the layer
  that contains the wrong claim. Note: this is the *fresh* spot-check rendering of the
  Gap-1 contradiction — the contradiction is now corroborated by an independent ground-
  truth check against odd-platform source.

Spot-check tally: **2 / 4 COVERED-CORRECT**, 1 PARTIAL, 1 COVERED-CORRECT+MISSED-SILENT,
0 COVERED-WRONG. Zero confidently-wrong claims this run at the sidecar layer — consistent
with the prior three runs. The MISSED-SILENT in SC-4 is the layer-bridge gap: a sidecar
correction was authored but the downstream feature flow was not refreshed to consume it —
exactly the contradiction the methodology's own self-consistency check (proposal 5)
would catch.

## cost

**The methodology's cost trend: FLAT-to-RISING.** `test-map/index.yaml` 1.26MB →
1.44MB → 1.69MB across three reviews — the bloat trend continues into the *shard*. The
six stale top-level monoliths (2.66MB total) are unsynchronised duplicates of the shards.
Per-verified-claim cost remains poor while `probe_verified` = 0: the sprint added 50
sidecars and 11 features but zero verified claims to the honest denominator. The
methodology spent ~10 maintainer-managed agent sessions and ~3-5M sprint tokens (estimate
from 9 batch commits + 9 `[next-batch]` orchestration commits) producing artefacts that
mostly live in the `STATIC-INFERRED` bucket. The two structural fixes that would change
this — substrate re-scan + probe write-back — are each a sub-day of code change.

**This review's own cost: ~85k tokens** — one `methodology-reviewer` agent, one pass, ~30
tool calls. Roughly in line with the prior rev-9 run (~95k); the rev-9 cost claim
("roughly one-seventh" of the rev-6 panel's ~480k-1.4M) continues to hold. Rev-9 itself
remains the cost subtraction the methodology needed. The review's value-vs-cost question
is harder this cycle: the same load-bearing gaps repeat for a fifth review — past some
threshold, *another review naming the same five gaps stops being the highest-leverage
spend* (the third-consecutive-no-action self-kill criterion of §16.5 is approaching). The
next review should not be run until at least one of proposals 1 / 3 / 4 has landed; if
the maintainer cannot get to those proposals before the next milestone, a `/panel`
invocation will produce the same five gaps for the sixth time.

## correlated_blind_spot_caveat

This review is a Claude-family agent auditing artefacts built by Claude-family agents. The
correlated-blind-spot risk is HIGH and not removable in-harness (APPROACH.md §16.3). Every
finding above is weighted by cited evidence — a `file:line`, a `wc -c`, a `grep` count, a
`git log`, a static-read of `runner.py` — never by the reviewer's confidence. The
maintainer's own spot-audit remains the one genuinely independent oracle. Three specific
cautions for this run:

(1) The Gap-1 contradiction (`permission_side_door` in F-031/F-019 vs the
`NamespaceAutocomplete.md` sidecar) was found by reading both artefacts; it is
mechanically detectable but the *interpretation* — "the UI sidecar is right, the feature
flow is wrong" — rests on the LSN-023 retrospective's authoritative reading, which is
itself a Claude-authored artefact. The maintainer authored LSN-023's `## Why it slipped`
section; that human-authored content is the load-bearing anchor.

(2) The Gap-3 finding (29 distinct axis labels) is the result of a deterministic grep; the
*judgment* that 29 is too many and that some of the variants represent the same axis under
different spelling is a Claude reading. The substrate-vs-sidecar contract divergence is a
structural fact; whether the right fix is canonicalisation (proposal 2) or selective
preservation is a maintainer call.

(3) The recommendation to *pause* Layer 4b reflection expansion (proposal 6) is the most
opinionated proposal this review makes. The methodology's strongest signal is the
reflection layer; pausing its scale-up is a real trade-off the maintainer may reject.
The reasoning is laid out — running reflections on a substrate without the UI axis
canonicalised would amplify Gap 1 — but it is a judgment call, not a citeable fact.

needs_human_verification:

- "Gap 1 / proposal 1 — confirm the maintainer accepts that `permission_side_door` is the
  wrong label for `getOrCreate`-behind-a-select-or-create-combo-box, AND that the
  `NamespaceAutocomplete.md` sidecar's LSN-023 reading is authoritative for F-031.yaml
  and F-019.yaml. A direct subtraction (delete those lines, leave a one-line note to
  LSN-023) is the proposed action."
- "Gap 3 / proposal 2 — confirm whether the maintainer wants to canonicalise the four
  UI-component axis labels onto a single `ui-interaction` axis (the substrate axis Rule
  18 names) or to keep the sub-classifications. If the latter, decide whether
  `react-components` and `ui-components` are the same axis or distinct (the substrate
  manifest's vocabulary is currently absent of either)."
- "Gap 4 / proposal 3 — confirm the static-read of `runner.py:1295-1410` is accurate
  (the merge function appends a `## probe_verifications` note section but never
  rewrites `confidence:`). The simplest live check: re-run probe P-001 against current
  ActivityController.md and inspect whether `confidence_per_field` changed."
- "Proposal 4 — confirm `b8c5dd1`'s `detail/`-as-canonical decision is the maintainer's
  durable intent, and that the six top-level monolith files can be deleted (the safety
  check `grep -rln 'test-map.yaml\|feature-flows.yaml\|concepts.yaml\|implicit-adrs.md\|
  doc-gaps.md\|refactoring-scopes.md' .claude/ playbooks/ adrs/ lineage/_extractor/`
  should run before deletion)."
- "Proposal 6 — confirm the maintainer's intent on Layer 4b sequencing. The
  recommendation to pause reflection scale-up until the substrate axis canonicalisation
  is done is a real trade-off; reflections produce the methodology's strongest signal
  but reflections on the *current* state would amplify Gap 1."
- "The maiden acceptance gate — `meta-reviews/validation/` still holds only a README;
  `gold-set.yaml` and `seeded-corpus/` do not exist. Until the maintainer authors them
  and `/panel validate` passes, this review (like every prior one) is
  `pre-acceptance-gate` and its findings are provisional. No agent can author the
  corpus — it is the external oracle, by design (APPROACH.md §16.4)."
- "The self-kill criterion (APPROACH.md §16.5: three consecutive runs with no actionable
  finding means the review has become the waste it audits, and is paused). This is run
  2 of rev-9; if proposals 1-3 do not land before the next milestone, run 3 will
  re-list the same five gaps, and a maintainer call on whether to pause `/panel` until
  artefact-level changes catch up is the appropriate response."
