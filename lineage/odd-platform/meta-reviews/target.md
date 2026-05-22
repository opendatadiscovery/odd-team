# The target — odd-platform agentic ontology

This file is the **explicit target** the Adversarial Review Panel measures the methodology against.

Before this file existed, "the target" was implicit: every panel reviewer and the chair filled in their own unstated notion of "done", so the verdict — *"is the methodology on track to hit the target?"* — was uninterpretable. An implicit target is a **fluent**: a phrase that sounds meaningful while carrying no shared, checkable content. The panel exists to catch exactly that failure and must not commit it itself. Case-law: `retrospectives/LSN-022`.

It is a **living, maintainer-owned artefact.** Detail it, correct it, tighten or loosen the thresholds, add or drop conditions — that is expected and encouraged. Every `/panel` run reads whatever this file says at that commit; every expert anchors its axis assessment on it; the chair reproduces it in the report.

## Status

- `version`: 1.1
- `ratified_by_maintainer`: v1.0 ratified 2026-05-21 by the maintainer. v1.1 adds conditions 9-11, which **transcribe `APPROACH.md` §0** (the operating stance — reverse engineering / Linus / senior product owner / UI-as-primary), merged into `main` by the maintainer on 2026-05-22. They reflect already-ratified intent — the maintainer directed and merged §0 — and are pending the maintainer's explicit review of their phrasing.
- `seeded_from`: the maiden panel's chair-drafted definition-of-done (2026-05-21), synthesised from `APPROACH.md` §1 (the eight promises), §14 (the honest-coverage axes), and the `CLAUDE.md` mission. v1.1's conditions 9-11 are transcribed from `APPROACH.md` §0 + rules 17-19. **This provenance is the point** — the target is traceable to named sources, not invented.
- `last_refined`: 2026-05-22

## The mission — what the odd-platform ontology is FOR

The odd-platform ontology exists so the ODD maintainer can hold the published documentation — then test coverage, then features — to a publishing standard, with **every user-facing claim traceable to the code that enforces it**. It is the queryable, code-anchored, self-maintaining model of odd-platform that turns O(n) code exploration into O(1) lookups and makes doc/test/code drift mechanically discoverable. (Mission sources: `CLAUDE.md`, `APPROACH.md` §1.)

## The target — "hit" conditions

The odd-platform ontology has **hit its target** when all of the following hold at one measured commit. Thresholds are the maiden draft — the maintainer refines them.

1. **Honest coverage, not vanity coverage.** `stress_verified_pct ≥ 0.80`, computed over a denominator of *all enriched sidecars* (not a handful), and that denominator covers `≥ 90%` of substrate nodes that carry Stress-Protocol triggers. The vanity axis (`nodes_with_sidecar / total`) is reported for trend only.
2. **Every claimed-fix LSN is structurally closed.** No `status: closed` LSN whose fix exists only as a prompt instruction; each closed LSN carries closure-evidence (the probe-run / scan-pass / batch that validated it).
3. **The eight §1 promises are demonstrably answerable from artefacts.** One task per promise — onboarding, impact analysis, ADR archaeology, test-coverage lookup, security/performance posture, doc-drift, feature-flow, control-matrix — completes from the ontology with **zero forced source opens**, drawn from a *randomly chosen* feature, not a pre-enriched one.
4. **Index/detail integrity.** Zero divergence between every reducer index and its `detail/` directory. No tracked finding is invisible to a consumer reading the index.
5. **No structural gate is prompt-only.** Each rejection criterion (`APPROACH.md` §5 Rules 13/15 + banned-phrase + pillar-count) has a non-LLM executor that runs before the batch commit; `coherence_sweep.py` exists and runs.
6. **The probe loop is closed.** A probe-run with `outcome: PASS` mechanically upgrades its originating sidecar's confidence to `PROBE-VERIFIED`; `stress_answers_probe_verified` is non-zero and tracked per batch.
7. **The methodology has been run end-to-end at least once at its current scope** — substrate scan → domain-extractor → Stress-Protocol enrichment → probe-runner → reducers + feature-flow-builder + feature-reflector → coherence-sweep → panel — on a substrate scanned *after* the latest APPROACH revision, with the honest-coverage axes recorded per batch as a time series, so convergence is observable rather than asserted.
8. **The panel itself is validated.** The maiden acceptance gate (`APPROACH.md` §16.4) has passed against a maintainer-authored corpus; panel reports are no longer `pre-acceptance-gate`; the `trend.md` scorecard shows a non-decreasing curve across ≥ 3 runs with consensus-finding count trending down.
9. **Reverse-engineering rigor (`APPROACH.md` §0.1).** Every operator-observable claim in the ontology is traced from the code read end-to-end, or measured against the running system — never inferred-and-hedged. No sidecar claim rests on a banned-phrase hedge where the code was traceable or the component runnable. "I don't know how X works" is never a shipped state.
10. **The user-facing surface is covered, not skipped (`APPROACH.md` §0.3; rules 17-18; §6 Step 3).** The UI interaction layer — the components, forms, modals, and interactive controls the operator actually uses — is present as a substrate axis and enriched as sidecars. For every feature, that UI layer is threaded into the feature flow: no feature carries `ui-incomplete`, and no feature analysis terminates at the backend endpoint chain. A `permission_side_door`-class finding minted from a backend-only chain is a defect.
11. **Features are reviewed at the senior-product-owner bar (`APPROACH.md` §0.2; rule 19; §15).** Every composed feature flow has a current feature-reflector reflection that reasons from the user's screen — generating and validating hypotheses on whether the operator can understand and use the feature, its convenience, its intuitiveness, its consistency with the rest of the platform, and its customizability — traced through the UI sidecars, not the API alone. Reusable UX patterns are surfaced as ADR candidates.

## On track vs. hit

**"Hit the target"** is the end state — all **eleven** conditions true at one commit. **"On track"** is the trajectory toward it. Pragmatically: conditions 1, 3, 4, 6, 9, 10, 11 are *measurable progress* the work drives toward; conditions 2, 5, 7, 8 are *closure conditions* that mark the target genuinely hit. The methodology is "on track" when 1/3/4/6/9/10/11 are trending up across `trend.md` rows; it has "hit the target" when all eleven hold together.

## How each panel reviewer uses this file

Every panel expert reads this file **first** and writes a `target_lens` section in its Phase-1 report — its own axis's reading of the target: the concrete bar that axis must clear, reflected through its role. The conditions are not all equally every axis's concern; this table is a starting map the maintainer may refine, and which each reviewer reasons beyond:

| Axis (expert) | Target conditions it most owns |
|---|---|
| Coverage (adversary) | 1, 3, 10 — does the ontology actually cover what the target requires — including the user-facing UI surface? |
| Process (methodologist) | 2, 5, 7 — are the closure conditions structurally reachable? |
| Cost (economist) | 4 + the cost discipline — is hitting the target affordable, and is waste blocking it? |
| Depth (engineer) | 1, 6, 9 — is the coverage deep enough, and reverse-engineered from the code rather than guessed? |
| Usefulness (practitioner) | 3, 11 — can a maintainer answer the eight promises, and are features reviewed at the senior-product-owner bar? |
| Honesty (skeptic) | 1, 2, 8, 9 — are the "hit" measurements trustworthy, and are claims traced, not hedged? |

The chair reproduces this file's conditions in every `panel-report.md`'s `## target` section and measures the verdict against them. The chair may surface proposed refinements to this file (routed `target-refinement`) — but it does not edit this file; the maintainer curates it.

## Maintainer curation

This file is yours. To improve it: tighten or loosen a threshold, add a condition the methodology should be held to, change how "hit" is split from "on track", re-map the per-axis table, or sharpen the mission statement. Bump `version` and `last_refined`. Set `ratified_by_maintainer: yes` once it reflects your real intent — the panel then drops the "provisional target" note. A vague target produces a vague verdict; a sharp target is the single highest-leverage improvement you can make to the panel.
