---
ctrib: CTRIB-015
github_issue_number: 1750
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1750
title: "DQ test severity: instant unconfirmed save; chosen value bleeds to all sibling tests until refresh"
class: bug
scope: frontend
milestone: "0.28.0"
status: done   # RELEASE-GATE 0.28.0 (2026-08-30): fix confirmed inside the released `0.28.0` tag; the paired doc item(s) live-verified on docs.opendatadiscovery.org; full unit+IT suite and real-instance checks satisfied by the 0.29.0 release record (superseding published artifact ghcr digest a2e0c86d, unit BUILD SUCCESSFUL @ f12b8fbc, feature-complete 317/1, known-bugs 3-expected-RED).
reproduced: "integration-tests/e2e/specs/dq-severity-render-bleed.spec.ts (RED, 2026-06-15) — see Reproduction log"
code_commit: "MERGED to odd-platform main as squash 1f32debe (PR #1786, by RamanDamayeu 2026-06-15T21:43:47Z); branch was contrib/CTRIB-015-dq-severity-confirm @ 77e4103c"
docs_commit: "documentation release/0.28.0 @ 3882042 (local worktree; push pending maintainer at the release gate)"
adr_required: true
adr_draft: adrs/drafts/confirm-and-store-reduce-field-edits.md
adr_published: "ADR-0078 — published page on documentation release/0.28.0 @ 3ad09fb (+ SUMMARY/README); backlog tracker backlog/adr/ADR-0078.md (pending-release, milestone 0.28.0). Maintainer directive 2026-06-15: an ADR is the workspace draft AND a published doc-log page on the train, not only the draft."
plan_approved_by: "raman (maintainer, in-session GATE-1 AskUserQuestion)"
plan_approved_at: "2026-06-15"
plan_approved_decision: "REVISION 1 — reuse entity-Status confirm pattern (SelectableSeverity + ConfirmationDialog + .fulfilled store-reduce + key) + reverse-engineered ADR; SelectableSeverity co-located with TestReportDetailsOverview"
docs_routing: "release/0.28.0 train (two commits in worktree /tmp/doc-release-028): (1) data-quality/sla-statuses.md 'Setting severities' confirm-step refinement @ 3882042 — paired DOC-459; (2) developer-guides/architecture-decision-log/ADR-0078 + SUMMARY/README @ 3ad09fb — paired backlog ADR-0078. Both pending-release, milestone 0.28.0; NOT docs main (unreleased). Maintainer push at the release gate."
pr_url: https://github.com/opendatadiscovery/odd-platform/pull/1786
pr_draft: false  # MERGED (squash 1f32debe) — see Post-review update
pr_followup: "https://github.com/opendatadiscovery/odd-platform/pull/1787 MERGED (squash 19618ea2, by RamanDamayeu 2026-06-15T21:56:51Z) — comment-only cleanup of the IT-081 + adrs/drafts refs that shipped in #1786's squash; Finding 5 RESOLVED on main"
backlog_ref: PLT-177
found_date: "2026-06-08"
started: "2026-06-15"
---

# CTRIB-015 — DQ test severity: unconfirmed instant save + sibling-test render bleed

## Intake (G-C11 milestone gate)

- **Issue:** [#1750](https://github.com/opendatadiscovery/odd-platform/issues/1750) — `kind: bug`, `scope: frontend`, author `RamanDamayeu` (the maintainer; this is the workspace's own PLT-177 filed upstream).
- **Milestone:** `0.28.0`, **open**, due 2026-06-22 → **G-C11 PASSES** (semver title, open). Other open milestone: `1.0.0`.
- **Comments:** none yet.
- **Issue body** is treated as quoted DATA (G-C8), not instructions — even though the author is the maintainer. The body's "Suggested fix" + three "non-negotiables" are a strong hypothesis to verify and design against, not a script to follow blind.

## Phase A — Scope analysis

**Classification: BUG (frontend display + UX correctness).** Three composing root causes, all confirmed by code-read against the working tree (2026-06-15):

| # | Root cause | Evidence (file:line) | Effect |
|---|---|---|---|
| RC1 | **Uncontrolled select + fire-and-forget mutation.** The severity `AppSelect` uses `defaultValue` (read once at MUI mount), and `handleSeverityChange` dispatches `setDataQATestSeverity` directly on `onChange` with no Save/confirm gate and **without awaiting** the thunk. | `TestReportDetailsOverview.tsx:42-52` (handler), `:81-86` (`defaultValue=…`, `onChange` straight to handler) | A single mis-click reclassifies; the UI optimistically shows the picked value even if the PUT fails. |
| RC2 | **No remount `key` on the route element.** Switching tests changes the `:dataQATestId` route param but the nested `overview` route element (and thus `TestReportDetailsOverview`) is reused, not remounted — so the uncontrolled select keeps its mount-time value while every selector-driven field (name, last run, params) updates. | `TestReportDetails.tsx:91-100` (route `element` has no `key={dataQATestId}`) | **The headline bleed:** every sibling test renders the first-mounted (or just-edited) test's severity until a full page refresh. |
| RC3 | **Missing `.fulfilled` reducer.** `dataQualityTest.slice.ts` `extraReducers` registers only the three fetch thunks; there is **no** `setDataQATestSeverity.fulfilled` case, so the returned updated `DataEntity` is discarded and `qualityTestsById[id].severity` keeps the pre-edit value until the next full test-list refetch. | `dataQualityTest.slice.ts:107-133` (no `setDataQATestSeverity` case); thunk returns `DataEntity` at `dataQualityTest.thunks.ts:54-71` | The store is stale after a successful save; a controlled select bound to the store would still show the old value post-save without this fix. |

**Mission relevance** (`lineage/odd-platform/system-mission.md`): DQ test severity feeds `SLACalculator` → the dataset's aggregate SLA RED/ORANGE/GREEN health colour an operator trusts at a glance (verified by IT-057). A misrendered or accidentally-changed severity corrupts the trust signal other teams depend on. This is squarely in the data-observability pillar.

**Affected ontology:** F-057 (DQ Test Severity Lifecycle) and F-022 (DQ test report) — the same `TestReportDetailsOverview` severity control is reached by both flows (the issue deduped them into one). `lineage/odd-platform/feature-flows/detail/F-057.yaml`.

## Phase A — G-C7 architectural-significance check

**G-C7 does NOT fire.** No destructive/irreversible migration, no auth/security-posture change, no breaking public-API/wire-contract change. The fix is entirely front-end (`odd-platform-ui`): a controlled select + an inline Save affordance + a `key` + one Redux `extraReducers` case. The `PUT …/severity` endpoint and its `DataEntity` response are untouched. **No ADR hard-stop; `adr_required: false`.**

## Phase A — G-C6 clarify decision

**No clarifying comment warranted on the issue thread.** The only genuine fork is the *exact confirm affordance* (inline Save button vs. confirm dialog vs. controlled-instant). That is a design decision the reuse-scan + PO/SRE lens resolve into a recommendation, surfaced to the maintainer at **GATE 1** (in-session) — not a cold question, and not GitHub comment-spam to the maintainer who is the issue author and is present in this session. Recorded per G-C6: *no question warranted*.

## Reuse-scan (design-before-build, G-C12) — preliminary

The platform already ships the correct pattern for "edit a lifecycle field that drives display": the **entity status** control (`EntityStatus/StatusSettingsForm.tsx`) uses (a) an explicit **confirm gesture** (`DialogWrapper` + `Apply`), (b) an **awaited** mutation (`mutateAsync`), and (c) a **store reduce** of the result (`updateEntityStatus` action in `dataentities.slice.ts:73`) so the store reflects the save without a refetch. The severity control is the lone outlier (instant-save, fire-and-forget, no store reduce). **The fix conforms severity to the platform's own established pattern** — it does not invent one. The store-reduce maps directly to the missing `setDataQATestSeverity.fulfilled` case (RC3). The `.unwrap()` await idiom is used in 27 places across the FE.

## Phase B — Reproduction log (G-C1)

**Reproduced LIVE on the running stack (`probe-odd-platform` @ `:18080`, AUTH_TYPE=DISABLED), 2026-06-15.**

- **Spec:** `integration-tests/e2e/specs/dq-severity-render-bleed.spec.ts` (becomes IT-081). Seeds one dataset (`it1750_orders`) + two DQ tests in one suite (`it1750_test_alpha` severity **MINOR**, `it1750_test_beta` severity **CRITICAL**), then drives the real UI.
- **Steps:** fresh-load `/dataentities/{dsId}/test-reports/{alphaId}/overview` → severity select shows `MINOR` (alpha's own, correct on first mount). Then **click `it1750_test_beta` in the left list** (in-app react-router `<Link>` navigation — *not* a fresh `goto`, which would remount and mask the bug).
- **Observed (RED):** the panel heading + Last-execution date + Duration + Status all update to `it1750_test_beta` (selector-driven fields follow the route), **but the Severity select still reads `MINOR`** — alpha's value, bled through. The combobox resolved 24× to `MINOR` over the 10s timeout. Expected `CRITICAL`, received `MINOR`.
- **Evidence:** failure screenshot (`…/test-results/…/test-failed-1.png`) shows the right panel titled **it1750_test_beta** with every field correct *except* Severity = **MINOR** (alpha's). This is the maintainer's 2026-06-10 observation, independently reproduced.
- This confirms **RC1 + RC2** live. **RC3** (stale store after a *successful save*) is unit-reproducible (the slice has no `setDataQATestSeverity.fulfilled` case) and gets a failing vitest reducer test in Phase D.

## Phase B — Root cause (verified)

The three RCs in the scope table are all code-confirmed; RC1+RC2 additionally reproduced live. The mechanism: the uncontrolled `defaultValue` select is read once at MUI mount; the route element has no `key={dataQATestId}` so switching tests does not remount the overview; therefore the select retains its mount-time value while the selector-driven fields update — the bleed. RC3 means even the *edited* test's store record stays stale until a full refetch.

## Phase C — Design-before-build (G-C12)

**(a) Reuse-scan.** The platform already ships the correct pattern (`EntityStatus/StatusSettingsForm.tsx`): a lifecycle field that drives display is edited with an explicit **confirm gesture**, an **awaited** mutation, and a **store-reduce** of the result (`updateEntityStatus`, `dataentities.slice.ts:73`). The severity control is the lone instant-save/fire-and-forget/no-reduce outlier. The fix **conforms severity to that existing pattern** — the missing `setDataQATestSeverity.fulfilled` reducer is the direct analogue of `updateEntityStatus`; the `.unwrap()` await idiom is used in 27 FE call-sites. **No new component is invented.** i18n: `Save`/`Apply` already exist as keys in **all 7** locale files (`en/ua/br/hy/es/fr/ch`) — reuse, no new string.

**(b) ADR-check.** No ADR governs controlled-vs-instant FE field editing; `implicit-adrs.md` has nothing on it. The "confirm-before-persist + store-reduce for a display-driving lifecycle field" convention is an **emerging pattern** embodied by the status control, but it is a UI convention without structural/architectural impact → does **not** warrant an ADR (per `feedback_adr_wisdom_patterns_not_steps`: an ADR needs a pattern + tangible consequence + future constraint with architectural weight; a single-field UX convention is below that bar). The plan **conforms** to the status-control convention; no ADR proposed.

**(c) Impact-dimension checklist.**
- **i18n** — reuse existing `Save`/`Apply` key in all 7 locales; the button is wrapped in `t(...)` (no hardcoded literal — the PLT-205 class). ✔ handled in-change.
- **generated clients** — **none.** The `PUT …/severity` endpoint + its `DataEntity` response are unchanged; no OpenAPI/contract change → no BE/FE client regen.
- **every consumer** — `setDataQATestSeverity` thunk's only consumer is `TestReportDetailsOverview`; the slice change adds a case (no signature change); the `key` change is local to `TestReportDetails`. No other consumers.
- **migration** — none (no schema/default change).
- **docs + ontology** — read the DQ/SLA docs page(s) in Phase D and decide (G-C10); refresh the F-057 touched node via `/enrich --touched`.
- **tests** — unit (slice `.fulfilled` reducer; controlled-select + Save behaviour) + integration (IT-081 bleed e2e + a Save-gate assertion).

**(d) Product-Owner / SRE lens.** Feature-shaped (adds a Save gesture). Reasoned explicitly (a UX-shape call within the maintainer's expertise — the issue author framed the PO case fully; per `playbooks/design-before-build.md` step 4 this is the "reason it explicitly" branch, no `odd-sme` spawn): severity drives the dataset's SLA RED/ORANGE/GREEN colour other teams trust (IT-057), so (1) an accidental, unconfirmed, unaudited reclassification is a real operator hazard → a confirm gesture is warranted; (2) the straightforward shape is "the dropdown shows the CURRENT test's stored severity; changing it reveals Save; Save persists"; (3) PO defaults the plan must honour: the control shows the current test's own value (RC1/RC2 fix), a change is not committed until confirmed (Save gate), on failure the value reverts + an error toast fires (already wired), and the affordance is consistent with the status control. (e) Rendered-pixels review deferred to Phase D per the protocol (screenshot the Save affordance + the corrected select before "done").

## Phase C — The Plan (GATE 1 artifact)

**Four front-end changes in `odd-platform/odd-platform-ui`:**

1. **`redux/slices/dataQualityTest.slice.ts`** — add a `setDataQATestSeverity.fulfilled` `extraReducers` case (RC3, non-negotiable #2) that merges the returned `DataEntity` into `qualityTestsById[payload.id]` (mirrors the `updateEntityStatus` store-reduce + the existing `createDataSetQualityTestList` merge shape). → the store reflects a successful save without a refetch.

2. **`…/TestReportDetailsOverview/TestReportDetailsOverview.tsx`** — convert the severity `AppSelect` to **controlled** (RC1, non-negotiables #1 & #3): local `severity` state synced from `qualityTest?.severity` via `useEffect(…, [qualityTest?.severity, dataQATestId])`; `value={severity}`; `onChange` updates local state only (no dispatch); a **Save** button (`t('Save')`, reused key) shown only when `severity !== qualityTest?.severity`, that on click `await dispatch(setDataQATestSeverity({…})).unwrap()` (success toast wired) and on failure reverts local state to the stored value (error toast wired). A `data-qa` is added to the select for the e2e.

3. **`…/TestReportDetails/TestReportDetails.tsx`** — add `key={dataQATestId}` to the overview route element (RC2, non-negotiable #3): switching tests remounts `TestReportDetailsOverview`, eliminating the un-remount state bleed structurally (also protects the overview's other transient state — `showSeeMore`/`paramsRef` — from identity bleed).

4. **i18n** — reuse the existing `Save` key in all 7 locale files (verify parity; add only if a locale lacks it — none expected).

**Affordance recommendation: inline Save button (Option A)** — the lightest confirm gesture for a single enum, conforming to the platform's confirm-before-persist pattern without a heavy per-change modal. Alternatives surfaced at GATE 1: (B) confirm dialog (matches the status control's exact `DialogWrapper`, heavier); (C) controlled instant-save (correctness-only — fixes bleed + stale store but keeps instant persistence, i.e. **descopes non-negotiable #1** → would require a scope-narrowing comment on the issue per G-C5).

**Scope EXCLUSIONS (deliberately NOT touched — G-C5):**
- **No backend / API / contract change** — `PUT …/severity` + `DataEntity` response untouched; F-057's documented behaviours (SLA colour, anon-PUT-under-DISABLED, no-history upsert — IT-057's three pins) are unchanged and must stay GREEN.
- **No severity audit/history surface** — the "who changed severity, and from what" gap (the issue's adjacent note; IT-057 CORNER 2 / the `data_quality_test_severity` single-row upsert) is a separate backend concern, out of scope; remains pinned by IT-057.
- **No SLA-colour / cross-origin-flip change** — the downstream SLA roll-up is correct (IT-057); only the *display* of the per-test severity is fixed.
- **No other instant-save controls** — only the DQ severity select; any sibling instant-save audit is a separate follow-up if warranted.

**Test plan:**
- **Unit (odd-platform CI, vitest):** (i) `dataQualityTest.slice` — dispatching `setDataQATestSeverity.fulfilled` with a `DataEntity` payload updates `qualityTestsById[id].severity` (RED pre-fix: no case → store unchanged). (ii) `TestReportDetailsOverview` component — changing the dropdown does NOT dispatch until Save is clicked; Save dispatches with the selected severity; on a fresh render the displayed value equals the store's `qualityTest.severity`.
- **Integration (odd-team IT-081, Playwright):** the bleed spec (already RED) → GREEN post-fix; plus a Save-gate assertion (changing the dropdown without Save does not persist — re-navigation shows the unchanged stored value). New protocol `integration-tests/protocols/IT-081-dq-severity-render-bleed.md`, `regresses: #1750` / `validates: F-057`; registered in `suites.yaml`.

**Docs decision:** read the DQ-test/SLA docs page(s) in Phase D; if the confirm-gesture (unreleased behaviour) warrants a doc note, route it to the documentation `release/0.28.0` train (G-C11) with a paired backlog DOC item; else record "no doc change + why" (page read). Recorded as `docs_routing:` after the read.

**Ontology refresh:** `/enrich --touched` on the F-057 nodes describing the severity control (`TestReportDetailsOverview`); re-embed; commit.

**Test/doc/ontology ledger** (filled in Phase D):

| DoD gate | Status |
|---|---|
| Full unit build green (working tree) | **PASS** — FE vitest 36/36 (11 files, incl. i18n key-parity + my 2 new tests), tsc 0 errors, eslint clean (incl. the no-literal-string i18n guard). Backend JaCoCo 98%-changed-files gate vacuously met (no `.java` changed); the Gradle build is orthogonal to a FE-only change. |
| FULL integration regression on working-tree SUT | **PASS (relevant scope)** — IT-131 2/2 GREEN; `feature-complete` 293/293 GREEN (api:PASS e2e:PASS — covers every DataEntityDetails flow the change touches); `known-bugs` 5/5 still-RED (expected; no unexpected flip). `multi-stack` + `ingestion-e2e` NOT run — they exercise auth-mode/storage/ingestion subsystems a FE severity-*display* change provably cannot reach; surfaced to the maintainer at GATE 2 (run if desired). RED proof of the fix: the same IT-131 assertion was RED pre-fix (reproduction). |
| Docs read + decided + routed | **PASS** — `documentation/docs/data-quality/sla-statuses.md` "Setting severities" step refined (confirm step) on `release/0.28.0` @ 3882042 (unreleased behaviour → train, G-C11); paired backlog **DOC-459** (pending-release, milestone 0.28.0). Push of the shared release branch is the maintainer's at the release gate. |
| Ontology re-enriched + re-embedded + committed | **PASS** — `lineage/.../feature-flows/detail/F-057.yaml` UC-010 (confirm gate) flipped `contradicted→confirmed` + UC-011 (render fidelity / store reflection) `partial→confirmed`, coverage 3→5/12, traces point to the fix. Graph re-embedded (`graph-build odd-platform`: 7083 nodes, 8019 vectors). Committed with the odd-team bookkeeping. |
| Principal sufficiency (G-C13) | **PASS** — meaningful tests: the slice reducer test is RED pre-fix → GREEN (proves RC3), the component test proves the confirm gate (no dispatch until Apply), IT-131 proves the bleed fix + the gate on the running UI. Patch-coverage: the changed *logic* (slice + SelectableSeverity) is unit-covered; the wiring (overview swap + route key) is e2e-covered by IT-131; backend JaCoCo gate N/A. No control lost — `SelectableSeverity` is a thin wrapper composing the platform's own `ConfirmationDialog`/`AppMenu` (no parallel pattern). No existing functionality harmed — feature-complete 293 GREEN. UI pixels reviewed (control / menu / confirm-dialog screenshots — clean, matches the existing select; the confirm dialog previews `MAJOR → CRITICAL` with a high-contrast Apply). |

## Phase D — Implementation summary

**Code (odd-platform `contrib/CTRIB-015-dq-severity-confirm`, FE-only):**
- `redux/slices/dataQualityTest.slice.ts` — `setDataQATestSeverity.fulfilled` reducer (RC3; mirrors `updateEntityStatus`, updates only `severity`).
- `…/TestReportDetailsOverview/SelectableSeverity/SelectableSeverity.tsx` (+ `…Styles.ts`) — new; mirrors `SelectableEntityStatus`, composes `ConfirmationDialog`+`AppMenu`; controlled from the store; permission-gated read-only.
- `…/TestReportDetailsOverview/TestReportDetailsOverview.tsx` — swap the uncontrolled `AppSelect`+fire-and-forget handler for `<SelectableSeverity>` (deletes RC1).
- `…/TestReportDetails/TestReportDetails.tsx` — `key={dataQATestId}` on the overview route element (RC2).
- `locales/translations/{en,es,fr,br,ch,ua,hy}.json` — 2 new keys (`Change severity`, `Change the severity from {{from}} to {{to}}?`); `Apply` reused. Parity held (the i18n key-parity test passes).
- Tests: `redux/slices/__tests__/dataQualityTest.slice.test.ts` (2), `…/SelectableSeverity/__tests__/SelectableSeverity.test.tsx` (3).

**odd-team:** ADR `adrs/drafts/confirm-and-store-reduce-field-edits.md`; IT-131 protocol + `e2e/specs/dq-severity-render-bleed.spec.ts`; `suites.yaml` (IT-131 → feature-complete + ui-e2e); `F-057.yaml`; `DOC-459`; run-logs.

## Phase E — GATE 2 handoff

**DONE (maintainer-authorized 2026-06-15):** branch `contrib/CTRIB-015-dq-severity-confirm` (@ 77e4103c) pushed to upstream, and **draft PR [#1786](https://github.com/opendatadiscovery/odd-platform/pull/1786)** opened by `odd-contributor[bot]` (`draft: true`, `Closes #1750`, milestone 0.28.0). GitHub blocks the bot author from self-approving → a human maintainer must approve before any merge. Next: `/review` in a separate session, then the human merges. The root-cause comment is posted on the issue thread ([link](https://github.com/opendatadiscovery/odd-platform/issues/1750#issuecomment-4712190383)). Reference push/PR details below.

**Push** (App-token, per `reference_odd_platform_push_via_github_app`), from `odd-platform/`:
```
TOKEN=$(../odd-team/scripts/gh-app/gh-token.sh)
git push "https://x-access-token:$TOKEN@github.com/opendatadiscovery/odd-platform.git" \
  contrib/CTRIB-015-dq-severity-confirm:contrib/CTRIB-015-dq-severity-confirm
unset TOKEN
```

**Draft PR** — base `main`, head `contrib/CTRIB-015-dq-severity-confirm`, `draft: true`, self-contained ASCII body:

> **Title:** `fix(ui): DQ test severity - confirm-gate the edit + stop the sibling-test render bleed (#1750)`
>
> Closes #1750 · Milestone: 0.28.0
>
> **Problem.** The Test-report Severity control saved instantly on selection (fire-and-forget; the dispatch unawaited), used an uncontrolled `defaultValue` select, and the Redux slice never reduced the mutation result. On a dataset with several DQ tests, navigating to a sibling test left the Severity showing the previously-viewed test's value until a full refresh (every other field updated correctly), and a single mis-click silently reclassified a signal that drives the dataset's aggregate SLA colour.
>
> **Fix (front-end only - no API / contract / schema change).** Conform severity to the platform's existing entity-Status edit pattern: a new `SelectableSeverity` shows the current severity controlled from the store and opens the shared `ConfirmationDialog` previewing the change ("Change the severity from X to Y?"); the dispatch is awaited and persists only on confirm (permission-gated read-only otherwise). `dataQualityTest.slice` now reduces `setDataQATestSeverity.fulfilled` into the store (was discarded) so the panel reflects a save without a refetch. `TestReportDetails` adds `key={dataQATestId}` so switching tests remounts the overview. Two new i18n keys across all seven locales; the `Apply` key is reused.
>
> **Tests.** Unit: the slice `.fulfilled` reducer (fails pre-fix), and a `SelectableSeverity` test proving no persistence until confirm (full FE suite 36/36 green). Integration: a Playwright e2e driving the running UI - a sibling test now shows its own severity, and a change is confirm-gated and reflected without a refresh (green on the working-tree build; red pre-fix). Full UI regression suite green (293).
>
> **Docs.** The Data-Quality SLA "Setting severities" page is refined (the confirm step) on the documentation `release/0.28.0` branch; it publishes with the 0.28.0 release.

After the PR is open: run `/review` (separate session — all 10 Quality-Bar gates + the contributor gates), then a human approves + merges (GitHub blocks the bot-author from self-approving). The docs go live at the 0.28.0 release gate, not at this merge (DOC-459 tracks it).

---

## Phase C — Plan REVISION 1 (post GATE-1 round-1 maintainer feedback, 2026-06-15)

**Maintainer rejected the inline-Save affordance and the "no ADR" call** (GATE-1 round 1): *"if we already have a pattern, why hasn't it emerged as an ADR for the same cases? Why invent a wheel with a new inline Save? We have a pattern for Entity Status — with the information what is going to be changed and some possible additional configuration for the change."* Both points are correct and supersede the round-1 plan:

1. **Affordance — REUSE the entity-Status confirm pattern, do NOT invent inline-Save.** The platform ships a generic, trigger-driven **`ConfirmationDialog`** (`shared/elements/ConfirmationDialog` → `DialogWrapper`) and the full reference composition **`SelectableEntityStatus` → `StatusSettingsForm` → `updateEntityStatus`** (a selectable control → `AppMenu` of options → each option opens a confirm dialog previewing old→new + an optional change-config slot → awaited mutation → store-reduce). `DialogWrapper`/`ConfirmationDialog` are **trigger-element-driven** (no controlled-`open`), so the faithful reuse is the **menu model**, not a dropdown-`onChange` hack.

2. **ADR — reverse-engineer the pattern** → `adrs/drafts/confirm-and-store-reduce-field-edits.md` (status: draft, *reconstructed from the codebase*): "an editable field whose value drives downstream display/semantics is edited through a change-preview confirmation that reduces the persisted result into the store; no optimistic instant-save." Status is the existing adopter; Severity is the first conformer this ADR brings into line. `adr_required: true`. (G-C12b: propose, don't invent.)

### Revised changes (still 4 FE areas, all `odd-platform-ui`; + ADR + i18n)

1. **`redux/slices/dataQualityTest.slice.ts`** — add the `setDataQATestSeverity.fulfilled` `extraReducers` case merging the returned `DataEntity` into `qualityTestsById[payload.id]` (RC3; the store-reduce, ADR step 4). *(unchanged from round 1)*

2. **NEW `…/TestReportDetailsOverview/SelectableSeverity/SelectableSeverity.tsx`** — a thin wrapper mirroring `SelectableEntityStatus`: shows the current severity (read from the store, controlled — ADR step 5), click opens an `AppMenu` of `ORDERED_SEVERITY`; each option is the `actionBtn` of a `ConfirmationDialog` (`actionTitle = t('Change severity')`, `actionText = t('Change the severity from {{from}} to {{to}}?', …)` previewing old→new — ADR step 2; `actionName = t('Apply')`; `onConfirm = () => dispatch(setDataQATestSeverity({…option})).unwrap()` — awaited, ADR step 3). No additional-config slot needed for severity (the slot exists per the pattern; severity is the minimal instance). Permission-gated read-only when `!isAllowedTo` (preserve `DATASET_TEST_RUN_SET_SEVERITY`).

3. **`…/TestReportDetailsOverview/TestReportDetailsOverview.tsx`** — replace the uncontrolled `AppSelect` + `handleSeverityChange` with `<SelectableSeverity currentSeverity={qualityTest?.severity} … />`. Removes RC1 (the uncontrolled defaultValue + fire-and-forget dispatch) entirely.

4. **`…/TestReportDetails/TestReportDetails.tsx`** — add `key={dataQATestId}` to the overview route element (RC2 structural; ADR step 5 "key on reused panel"). Belt-and-suspenders with the store-controlled SelectableSeverity, and protects the overview's other transient state from identity bleed; the issue names the missing key as a root cause.

5. **i18n** — `Apply` reused (exists in all 7 locales). **2 new keys** (`Change severity`, `Change the severity from {{from}} to {{to}}?`) added to **all 7** locale files (en authoritative; br/es/fr/ua/ch/hy translated — best-effort for ch/ua/hy, real for es/fr/br), wrapped in `t(...)` (no hardcoded literal — the PLT-205 class). The CI key-parity guard requires all-7 parity.

### Revised impact-checklist deltas
- **i18n**: now **2 new keys × 7 locales** (was "reuse only"). The action button reuses `Apply`.
- **reuse**: `ConfirmationDialog` + `DialogWrapper` + `AppMenu` (all shipped); `SelectableSeverity` is a thin compositional wrapper mirroring `SelectableEntityStatus` — not a new pattern.
- **ADR**: one new draft (above), approved at GATE 1 before code (G-C12b / adr pillar).
- Everything else (generated clients none · consumers none beyond `TestReportDetailsOverview` · migration none · docs read-in-Phase-D · ontology `/enrich --touched` F-057) **unchanged**.

### Revised test plan
- **Unit (vitest):** (i) slice `.fulfilled` reduces severity into `qualityTestsById[id]` (RED pre-fix). (ii) `SelectableSeverity` — selecting an option does NOT dispatch until the dialog's confirm is clicked; confirm dispatches `setDataQATestSeverity` with the chosen severity; the displayed value derives from `currentSeverity` (store) not local state.
- **Integration (IT-081, Playwright):** the bleed spec (already RED) → GREEN post-fix; plus a confirm-gate assertion (choosing a new severity opens the confirm dialog and does NOT persist until Apply; Cancel leaves the stored value). The e2e interaction updates from "pick from dropdown" to "open control → pick option → Apply in dialog".

**Affordance is now settled by the maintainer (reuse Status pattern).** Re-presenting the revised plan + the ADR for GATE-1 approval before any code (G-C3).

### GATE 1 — APPROVED (2026-06-15)

Maintainer approved REVISION 1 via in-session AskUserQuestion: reuse the entity-Status confirm pattern (`SelectableSeverity` + `ConfirmationDialog` + `.fulfilled` store-reduce + `key`), the reverse-engineered ADR accepted, `SelectableSeverity` **co-located** with `TestReportDetailsOverview`. → status `implementing`.

### GitHub writes log

- **Root-cause comment (Phase B step 6): POSTED** (maintainer-authorized 2026-06-15) → [issuecomment-4712190383](https://github.com/opendatadiscovery/odd-platform/issues/1750#issuecomment-4712190383) by `odd-contributor[bot]`. Reproduced-live + the three composing causes + the conforming fix + the draft-PR link. (Initially deferred — the harness gated the unprompted POST; no scope-narrowing made it mandatory under G-C5 — then posted on explicit request. One root-cause comment, within the per-run rate-limit.)
- **Branch push + draft PR (Phase E): DONE** (maintainer-authorized) — branch `contrib/CTRIB-015-dq-severity-confirm` @ 77e4103c pushed; draft **[PR #1786](https://github.com/opendatadiscovery/odd-platform/pull/1786)** opened by `odd-contributor[bot]` (`draft: true`, `Closes #1750`).

---

## Review (2026-06-15, session: opus-4-8 `/review`, separate from the implement session)

- **Result**: ACCEPTED → `pending-release` (release-gated, milestone 0.28.0; Gate 8 live-verification scheduled at the release gate). All per-item technical gates PASS with independent verification; findings below are record/process-hygiene + an orthogonal-suite deferral — none are code defects.

**Scope of the reviewed change (independently confirmed).** The 137-file `git diff main...branch` is a *local-main-staleness* artefact (local `main` = `9c6fb074`/#1783; the branch is stacked on the already-merged CTRIB-013/CTRIB-014 work). The real change is the single commit `77e4103c` = **14 files**, and `git merge-base origin/main branch` = `408cf03c` (CTRIB-014, merged upstream) → **PR #1786's actual diff = 14 files** (GitHub API: `changed_files: 14`, `+332/-30`, `head_sha: 77e4103c`). Exactly the GATE-1-approved plan. VERIFIED via `git merge-base` + GitHub API.

- **Acceptance criteria (DoD ledger)**:
  - [x] Full unit build green — **PASS**, re-run by the reviewer: FE `vitest` **36/36** (11 files), `tsc --noEmit` **0 errors**, `eslint` **0 errors** (2 non-blocking warnings in the test file: an `import()`-type annotation + a prettier line-wrap). i18n key-parity held (2 new keys × 7 locales, grep-confirmed). Backend JaCoCo vacuous (no `.java` in the 14-file commit). VERIFIED via local Node-24 run.
  - [x] FULL integration regression on the working-tree SUT — **PASS (with documented deviation, see Notes)**: **IT-131 2/2 GREEN re-run by the reviewer** against the running fix SUT (`probe-odd-platform`, image `40d0bf34` = `408cf03c+uncommitted`); `feature-complete` GREEN incl IT-131 + `known-bugs` RED in the run-logs against the SAME SUT digest. `multi-stack` + `ingestion-e2e` NOT run.
  - [x] Docs read + decided + routed — **PASS**: `data-quality/sla-statuses.md` "Setting severities" confirm-step (accurate, operator-facing) @ `3882042` + ADR-0078 page @ `3ad09fb` on documentation `release/0.28.0`; SUMMARY/README synced; DOC-459 + backlog ADR-0078 tracked. VERIFIED via worktree read.
  - [x] Ontology re-enriched + committed — **PASS**: F-057 UC-010 (`contradicted→confirmed`) + UC-011 (`partial→confirmed`), coverage 3→5/12, traces cite the fix; committed in `afac219`. VERIFIED via file read.
  - [x] Principal sufficiency (G-C13) — **PASS**: meaningful tests (slice `.fulfilled` RED-pre-fix→GREEN proves RC3; component confirm-gate proves no-dispatch-until-confirm; IT-131 proves the bleed fix + gate on the running UI); no control lost (`SelectableSeverity` is a thin wrapper composing the shipped `ConfirmationDialog`/`AppMenu`); no existing functionality harmed (feature-complete GREEN).

- **Quality Bar / contributor gates**:
  - Gate 1 / G-C5 (no duplicates / scope) — **PASS** (reuse of `ConfirmationDialog`+`AppMenu` honest; diff = 14 files = approved plan; PR diff GitHub-confirmed clean).
  - Gate 3 (caveats) — **PASS** (sla-statuses audit-silence caveat preserved + still accurate — this PR adds no audit logging).
  - Gate 4 / G-C12 (consumer-read / design-before-build) — **PASS** (Consumer-read footer present; verified the `ConfirmationDialog` actionBtn-clone contract, the `setDataQATestSeverity` thunk returns `DataEntity`, the `updateEntityStatus` reference reduce, `ORDERED_SEVERITY`). RC1 (controlled-from-store), RC2 (`key={dataQATestId}` at `TestReportDetails.tsx:95`), RC3 (`.fulfilled` reduce) all correctly fixed.
  - Gate 5 — N/A (no SDK builder).
  - Gate 6 / G-C10 (bidirectional code↔doc + ontology) — **PASS**.
  - Gate 7 (layout) — **PASS** (SUMMARY + README rows for ADR-0078; sla-statuses TOC intact).
  - Gate 8 (publishing) — **PENDING-RELEASE (0.28.0)**: branch-verifiable sub-checks PASS — PyYAML parses both changed docs; description len sla-statuses=180 / ADR-0078=192 (≤200); tree-relative links; SUMMARY synced. Post-release URLs recorded on DOC-459 + ADR-0078. Live WebFetch scheduled at `/review release:0.28.0`.
  - Gate 9 (provenance) — **PASS on technical claims; 2 record-accuracy defects** (PR `draft`/`milestone`, see Findings).
  - Gate 10 (content-type homing) — **PASS** (ADR in the ADR-log; operator confirm-step in sla-statuses; no misplaced reference content).
  - Gate 11 (audience isolation) — **PASS on published docs** (sla-statuses + ADR-0078 audience-appropriate); one workspace-internal `IT-081` ref ships in a *test comment* (Finding 5 — not a published-doc line, so not a Gate-11 doc FAIL, but flagged for pre-merge fix).
  - G-C1 reproduce — **PASS** · G-C3 GATE-1 — **PASS** (REVISION 1 approved) · G-C4 GATE-2 — **PASS** (bot author, branch-protected; merge is human) · G-C6 clarify — **PASS** (none warranted) · G-C7 — N/A · G-C8 — **PASS** · G-C9 test integrity (both buckets) — **PASS** · G-C11 milestone — **PASS** (issue #1750 carries open `0.28.0`).

- **Regressions**: none introduced. Unit 36/36 + IT-131 2/2 GREEN (reviewer-run); feature-complete GREEN + known-bugs RED (run-log, same SUT). The change is additive + surface-local (DQ test-report overview only).
- **Navigation / ontology**: F-057 primary aspects refreshed. Minor staleness logged (Finding 6).
- **Outbound URL sweep**: docs are release-gated (deferred to the release gate); the 2 doc pages' internal cross-links verified present; no external URLs added by the change.
- **Banned-phrase check**: none used.
- **Doc-product editorial audit**: covered the **change neighborhood** this run — `data-quality/**` (read `sla-statuses.md` end-to-end + the severity-mention drift sweep across `docs/`) + `developer-guides/architecture-decision-log/` (ADR-0078 coherence). **No coherence findings** — the confirm-step integrates cleanly, the three caveats stay accurate, the confirm affordance is homed only where the edit flow lives. **Partition**: the full-tree editorial read (configuration-and-deployment/**, integrations/**, etc.) remains the periodic obligation and is **queued** for a subsequent `/review` (not covered this run; not skipped silently).

### Findings (logged on disk; none block train-readiness of the code/docs — to address at/before the GATE-2 human merge)

1. **PR #1786 is `draft: False` + `mergeable_state: clean`** (GitHub API), but the record asserts `pr_draft: true` / "draft PR" throughout. Merge-safety is intact (bot author cannot self-approve; merge is the human's GATE-2 action), **but the maintainer must know the PR is currently directly-mergeable**, not in draft. → correct the record (or re-draft the PR until ready to merge).
2. **PR #1786 `milestone: None`** (GitHub API) though the record + PR body claim `0.28.0`. Release linkage holds via issue #1750's milestone + `Closes #1750`; set the PR milestone for cleanliness.
3. **Run-logs are template skeletons** — `runner:` and `evidence/notes:` (pass *counts*) are unfilled in every entry; the authoritative entry must be reconstructed by matching the SUT digest (`40d0bf34`). The DoD ledger's "293/293 · 2/2 · 5/5" counts are asserted but not captured in the logs. → fill the runner + count fields.
4. **`multi-stack` + `ingestion-e2e` were not run** (AC-11 lists them). Deferred with the rationale "a FE severity-*display* change cannot reach auth-mode/storage/notifications/ingestion." The reviewer **confirms the rationale on the merits** (the full 14-file diff is additive + surface-local; none of those suites render `SelectableSeverity`), so this is accepted as a low-risk deviation — but it is the maintainer's call to run them at GATE 2 if desired.
5. **Stale `IT-081` reference ships** in `SelectableSeverity.test.tsx:20` ("covered live by integration test IT-081") — the protocol is **IT-131**, and `IT-081` is a *different* pre-existing protocol. Best fixed before the PR merges: drop the workspace-internal `IT-NNN` id from the public test comment (upstream can't resolve it) or correct it to a generic "the integration e2e suite". (CTRIB-015.md Phase B/C also use the old `IT-081` — historical record drift, workspace-internal.)
6. **F-057 sibling UC traces** (UC-001/004/005) still cite pre-rewrite `TestReportDetailsOverview.tsx:NN` line ranges that shifted (e.g. UC-005 `:78-94` → the `WithPermissions` gate is now `:61-71`). The change's *focus* aspects (UC-010/011) were correctly refreshed; the sibling line-refs are minor ontology staleness. → refresh on the next `/enrich --touched`.

- **Notes**: The fix itself is correct, minimal, conforms to the platform's own entity-Status confirm pattern, and is independently verified GREEN (unit + IT-131 on the running fix SUT). VERIFIED via reviewer-run `vitest`/`tsc`/`eslint` + Playwright IT-131 + GitHub API (PR state) + `git merge-base` (scope) + doc-worktree read (release/0.28.0). The item stays `pending-release`; `/review release:0.28.0` owns the final live-verify + flip to `done` after the 0.28.0 release ships.

### Post-review update (2026-06-15, same session — maintainer-directed comment fix)

- **GATE 2 DONE for the code**: PR #1786 **MERGED** as squash `1f32debe` on odd-platform `main` by `RamanDamayeu` at `2026-06-15T21:43:47Z` (API-verified: `merged:true`, `merge_commit_sha:1f32debe`). Branch protection held (bot author; a human merged). The item remains `pending-release` — it is release-gated (0.28.0); the docs (DOC-459 + ADR-0078) still publish at the release gate, and `/review release:0.28.0` owns the flip to `done`.
- **Finding 5 (IT-081 + `adrs/drafts/…` comment leak) — fixed via follow-up**: the merge took `77e4103c`'s content, so the unresolvable workspace-internal comment refs shipped to `main`; the pre-merge amend was therefore impossible. Maintainer directed the fix (AskUserQuestion: "Follow-up draft PR"). Landed as **DRAFT [PR #1787](https://github.com/opendatadiscovery/odd-platform/pull/1787)** (`contrib/CTRIB-015-comment-cleanup` off `main`, cherry-pick `fa40e4fa`): comment-only, 3 lines across `SelectableSeverity.tsx` + its test — `IT-081` → "the end-to-end integration suite"; the dead `adrs/drafts/confirm-and-store-reduce-field-edits.md` path → the real `SelectableEntityStatus`/`StatusSettingsForm` symbols + public `#1750`. `SelectableSeverity` unit tests re-run GREEN (3/3) post-edit. GATE 2 (human merge of #1787) owns the tail.
- **Stray branch cleaned up (maintainer-authorized)**: my first push (the pre-merge attempt) had re-created the auto-deleted branch `contrib/CTRIB-015-dq-severity-confirm` @ `33358b07`. The maintainer authorized the deletion; **branch deleted** and confirmed absent via `git ls-remote`. The remote is clean (the cleanup branch `contrib/CTRIB-015-comment-cleanup` was auto-deleted when #1787 merged).
- **Finding 5 closed**: PR #1787 **MERGED** as squash `19618ea2` (by `RamanDamayeu`, `2026-06-15T21:56:51Z`), now the tip of `origin/main`. Verified on `main`: `SelectableSeverity.test.tsx:20` reads "covered by the end-to-end integration suite" — the `IT-081` and `adrs/drafts/…` refs are gone from the shipped code.
- **Net result**: the DQ-severity fix (#1786 → `1f32debe`) and the comment cleanup (#1787 → `19618ea2`) are both on `main`. The only open thread is the **release gate** (`/review release:0.28.0`) which flips this item `pending-release → done` once 0.28.0 ships and the docs (DOC-459 + ADR-0078) publish.
