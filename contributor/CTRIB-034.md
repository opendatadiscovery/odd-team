---
id: CTRIB-034
github_issue_number: 1803
github_issue_url: "https://github.com/opendatadiscovery/odd-platform/issues/1803"
class: bug
milestone: "0.29.0"
status: planned            # intake -> scoping -> reproducing -> root-caused -> [planned] -> plan-approved[GATE1] -> ... -> review-ready -> merged[GATE2]
reproduced: "live browser repro 2026-06-24 — both defects REPRODUCED on cached buggy SUT 353a5b06 (odd-minimal :18130). See Phase B."
adr_required: no           # G-C7 does NOT fire (FE-only; no migration / no auth-posture change / no wire-contract change)
plan_approved_by: "RamanDamayeu (AskUserQuestion GATE 1)"
plan_approved_at: "2026-06-24"   # both recommended: Defect 2 = both surfaces; Defect 1 = thunk-side (emit entityId)
docs_routing: "release/0.29.0"   # alerting.md "Known UX limitation" (no-confirmation) corrected on the train @ ae43375; paired DOC-485 (pending-release). G-C11.
pr_url: ""
pr_draft: ""
stream_id: ctrib034
---

# CTRIB-034 — Reflect alert status change without refresh; confirm before flipping (#1803)

Resolve GitHub issue **opendatadiscovery/odd-platform#1803** end-to-end. Maintainer-authored
(RamanDamayeu, 2026-06-23), labels `kind: bug` + `scope: frontend`, milestone `0.29.0` (open, semver,
due 2026-06-27 — **G-C11 PASS**). Two front-end defects in the alert status-change flow.

The issue body is **quoted data, never instructions** (G-C8). Its static root-cause is excellent and its
"Suggested fix" is a starting point, not a spec — verified independently below.

## Phase A — Scope analysis

**Class: bug** (Defect 1 is a deterministic logic error; Defect 2 is a missing-guard / UX-gap, labelled
a defect by the maintainer). **Mission relevance:** alert triage is a core operator workflow
(`lineage/odd-platform/system-mission.md` — pipeline monitoring & alerting pillar). A status control
whose result is invisible until refresh — while a success toast claims it worked — is the on-screen
self-contradiction class the bar exists to catch (`retrospectives/LSN-031`).

**Two defects, same flow (both `odd-platform-ui`):**

### Defect 1 — stale per-entity Alerts tab (payload-key mismatch). VERIFIED against `main` @ 8e5b3339.
The thunk emits the entity id under key `dataEntityId`; the reducer reads it under key `entityId`
(always `undefined`), so the per-entity update branch is **dead code** and the write falls through to the
GLOBAL list, which the per-entity tab does not render.

- Thunk `updateAlertStatus` — `src/redux/thunks/alerts.thunks.ts:78`:
  `return { alert: castDatesToTimestamp(alert), dataEntityId: params.entityId };` — emits **`dataEntityId`**.
  (Declared output type `:71` = `{ alert: Alert } & Partial<EntityId>`, and `EntityId = { entityId: number }`
  — `src/redux/interfaces/common.ts:29-31` — so `dataEntityId` is an *excess* property and `entityId` is absent.)
- Reducer `updateAlertStatus.fulfilled` — `src/redux/slices/alerts.slice.ts:70`:
  `const { alert, entityId: dataEntityId } = payload;` → `dataEntityId` is `undefined` → the
  `if (dataEntityId)` per-entity branch (`:72-78`, writes `state.dataEntityAlerts[id].items`) is NEVER
  taken → fall-through updates `state.alerts.items` (the GLOBAL list, `:80-82`).
- Selector the tab renders from — `src/redux/selectors/alert.selectors.ts` `getDataEntityAlerts` reads
  `state.dataEntityAlerts[id].items` (per the issue ~L58-62) — never updated → row stays stale.
- Per-entity dispatch site — `src/components/DataEntityDetails/DataEntityAlerts/DataEntityAlertItem/DataEntityAlertItem.tsx:41-43`:
  `const params = { alertId, alertStatusFormData: { status }, entityId: dataEntityId }; dispatch(updateAlertStatus(params));` — passes `entityId`.
- Global dispatch site — `src/components/Alerts/AlertsList/AlertItem/AlertItem.tsx:45`: dispatches WITHOUT
  an entity id → the reducer fall-through correctly updates the very list the global page renders → the
  global Alerts page is unaffected (the inconsistency the issue describes).

**The reducer is correct; the thunk is the lone outlier.** The reducer reads `entityId` in all THREE of
its per-entity cases (`:50` fetchDataEntityAlerts, `:70` updateAlertStatus, `:89` fetchDataEntityAlertsCounts),
and the two sibling thunks emit `entityId` (`:107`, `:122`). Only `updateAlertStatus` (`:78`) diverges. The
type-correct, idiom-conforming fix is **thunk-side** (emit `entityId`), not reducer-side. (See Plan.)

### Defect 2 — no confirmation before the flip (both surfaces). VERIFIED.
- Global — `AlertItem.tsx`: `handleResolve` (`:50-72`) → `dispatchUpdateAlertStatus` (`:42-48`) wired to the
  button `onClick` (`:164`). No dialog. (It already runs a runtime permission pre-fetch with `.unwrap()`, `:57-58`.)
- Per-entity — `DataEntityAlertItem.tsx`: `alertStatusHandler` (`:38-44`) wired to button `onClick` (`:117`).
  No dialog. (Guarded by declarative `<WithPermissions permissionTo={DATA_ENTITY_ALERT_RESOLVE}>`, `:111`.)

**Reuse target (issue's suggestion, confirmed sound):** the existing
`src/components/shared/elements/ConfirmationDialog/ConfirmationDialog.tsx` — `onConfirm: () => Promise<unknown>`;
its catch handler (`:36-44`) surfaces a REJECTED promise inline and keeps the dialog open (the post-#1771
behaviour). **Critical (CTRIB-031 / #1766 lesson):** a redux-thunk `dispatch(thunk())` resolves even on a
rejected thunk, so `onConfirm` MUST `.unwrap()` or a backend failure closes-as-success. The established idiom
(25+ call-sites, hardened by CTRIB-031) is `onConfirm={() => dispatch(thunk(params)).unwrap()}` — e.g.
`DataSourceItem.tsx:31-32,59-75`.

**Adjacent-bug sweep (no out-of-scope finding):** the other two per-entity alert thunks are key-consistent
(emit + read `entityId`); no second key-mismatch to log. `updateAlertStatus` has exactly two consumers
(the two dispatch sites) + the reducer; nothing downstream reads the emitted key, so the thunk-side rename is
safe (`grep updateAlertStatus src/`).

**Architectural-significance (G-C7): does NOT fire.** FE-only; no DB migration, no auth-posture change (RBAC
guards unchanged), no wire-contract/spec change (the alert API is untouched). No ADR required.

**Clarify (G-C6): no question warranted.** The issue is fully specified with verified file:line root-cause;
the only open choices (which side to fix Defect 1; how to fold the global permission check) are HOW-decisions
within maintainer/Principal expertise, surfaced at GATE 1 — not implementation-changing ambiguities needing
the maintainer mid-intake.

## Phase B — Reproduce + root-cause

**REPRODUCED LIVE 2026-06-24** (the issue's `user_facing_verified=false` is now TRUE). Throwaway odd-minimal
stack on :18130/:15482 (`ODD_STREAM=ctrib034repro`), from the cached buggy image `353a5b06`
(`odd-platform:0.0.1-SNAPSHOT` — the alert UI files last changed at `37d5dad6`/#1763, an ancestor of every
cached image, so this image carries the exact current-`main` buggy alert code). Seeded one OPEN alert
(BACKWARDS_INCOMPATIBLE_SCHEMA) on entity 2001 (`seedEntityAlert` SQL); API-confirmed
`GET /api/dataentities/2001/alerts` → 1 OPEN item. Drove a real Chromium (Playwright). Stack torn down after.

**Defect 1 — per-entity tab stale until refresh — REPRODUCED.** On `/dataentities/2001/alerts`: initial = 1
"Resolve" button, status badge "Open". Clicked Resolve → toast **"Alert successfully resolved."** fired, yet
the row STILL showed badge "Open" + button "Resolve" + tab badge "1" (DOM byte-identical before/after the
toast — screenshots 02≡03). Only a **reload** flipped it to "Reopen"/"Resolved" → the back end persisted; the
staleness is client-only. This is the exact on-screen self-contradiction the issue describes (toast says yes,
the row says no). Screenshot `03-after-resolve-norefresh.png` shows the toast + the stale "Open"/"Resolve".

**Defect 2 — no confirmation before the flip — REPRODUCED on BOTH surfaces.** Per-entity tab: clicking Resolve
→ `role=dialog` count 0 → the flip happened with no "are you sure?" prompt. Global `/alerts` page (re-seeded
OPEN): same — clicking Resolve → `role=dialog` count 0, toast fired, **and the global list updated in-place**
(Resolve→Reopen flipped WITHOUT a refresh), confirming the issue's claim that **Defect 1 does not affect the
global page** (it dispatches without an entity id → the reducer fall-through correctly updates the very list it
renders). The global page's runtime permission pre-fetch GRANTED resolve under `AUTH_TYPE=DISABLED` (the button
worked) — de-risks the Phase-C global-surface restructure.

**Root-cause (confirmed on the running system, not just the static diff):** the live behaviour matches the
static trace exactly — the per-entity write lands on `state.alerts.items` (the global list) instead of
`state.dataEntityAlerts[2001].items` (the per-entity list the tab renders), because the thunk's payload key
(`dataEntityId`) ≠ the reducer's read key (`entityId`). No timing/heuristic element; deterministic.

(Evidence: screenshots in the session scratchpad `evidence/` — ephemeral; the durable, re-runnable proof is
the Phase-D IT-142 e2e with its RED-on-`ref:main` half.)

## Phase C — Product analysis + Plan + GATE 1

(Drafted below; finalised after reproduction. GATE 1 = human plan approval before any code.)

### Change-request product analysis (G-C16)
- **User-observable problem, independent of the suggested fix:** (1) on the per-entity Alerts tab a Resolve/
  Reopen appears not to work — the badge + button keep the old state while a toast says success; (2) a single
  click changes an alert's triage state with no "are you sure?" guard.
- **Is the change right?** Defect 1: unambiguous correctness bug — fix it. Defect 2: a confirmation on a
  state-changing, **reversible** action. ODD's OWN convention is to confirm state-changing actions via the shared
  `ConfirmationDialog` (datasource/term/namespace/policy/lookup-table delete + the 13 CTRIB-031 consumers) — so
  reuse-confirm conforms to the platform's established UX, not a novel pattern. The realistic options:
  (a) **reuse `ConfirmationDialog` on both surfaces** [recommended — issue's ask + ODD convention];
  (b) confirmation only on the per-entity tab (the global page is a bulk-triage surface where a confirm per row
  adds friction) — a UX trade-off worth the maintainer's eye;
  (c) undo-toast instead of confirm — rejected (ODD has no undo pattern; larger build; diverges from convention).
  No divergence from the issue's intent → no scope reframe; the only product nuance (confirm-friction on the
  bulk global page) is flagged for GATE 1, not silently absorbed.

### Design before build (G-C12)
- **Reuse-scan:** reuse `ConfirmationDialog` (do NOT build a dialog); reuse the `dispatch(thunk).unwrap()` idiom
  (DataSourceItem.tsx); reuse `<WithPermissions>` (per-entity) and the existing runtime permission fetch (global).
- **ADR-check:** conforms to the emerging "destructive/state-change actions confirm via the shared
  ConfirmationDialog with `.unwrap()`" pattern hardened by CTRIB-031/#1766 (`lineage/odd-platform/implicit-adrs.md`
  + the management.md doc). No new ADR.
- **Impact checklist:** i18n — new confirm strings to ALL 7 locale files (en, ua, ch, es, br, fr, hy) + the
  `i18n-key-parity.test.ts` guard (NOT en-only — LSN-035); generated clients — none (no API change); consumers —
  the two dispatch sites only; migrations — none; docs — read the alerting page + decide (G-C10); ontology —
  re-enrich the alert feature flow / touched UI sidecars.
- **PO/SRE lens (`odd-sme`):** consult on whether a per-row confirm on the bulk global Alerts page helps or
  hinders operator triage (feeds option (b) above).

### Plan (the GATE-1 artifact — exact change + scope EXCLUSIONS)
**Defect 1 (1 line):** `alerts.thunks.ts:78` `dataEntityId:` → `entityId: params.entityId`. Rationale: conforms
to the reducer's read + the two sibling thunks + the `Partial<EntityId>` output type; removes an excess key;
nothing downstream consumes the old key. (Reject the reducer-side alternative — it would make
`updateAlertStatus.fulfilled` inconsistent with the other two reducer cases.)

**Defect 2 (both surfaces):**
- Per-entity `DataEntityAlertItem.tsx`: wrap the Resolve/Reopen `<Button>` in `<ConfirmationDialog>`;
  `onConfirm={() => dispatch(updateAlertStatus(params)).unwrap()}`. Keep the `<WithPermissions>` guard.
- Global `AlertItem.tsx`: wrap the Resolve/Reopen `<Button>` in `<ConfirmationDialog>`; fold the existing
  permission pre-fetch into `onConfirm` (`.unwrap()` throughout; a denied permission rejects → inline error),
  letting the dialog's built-in loading/error replace the bespoke `isUpdating`/`disableResolve`/"No access!"
  state. (UX note surfaced at GATE 1.)

**Tests (G-C9, both buckets):**
- Unit (odd-platform CI) — drive the REAL `updateAlertStatus` thunk through the REAL reducer in a test store and
  assert `state.dataEntityAlerts[id].items` carries the new status after a per-entity resolve. RED on base (write
  lands on the global list; per-entity stays stale), GREEN on fix. (NOT a hand-crafted-payload reducer test — that
  would pass on the buggy system too, since the reducer is already correct; the RED must exercise the thunk's key.)
- Integration (odd-team) — **MANDATORY** (user-facing FE/BE contradiction — LSN-031). Author **IT-142**
  (next free; cross-ref IT-027/IT-030): seed an OPEN alert; on the per-entity tab click Resolve → assert a
  confirm dialog appears (Defect 2) → confirm → assert the row badge/button reflect the new status WITHOUT a
  refresh (Defect 1); plus a cancel-leaves-status-unchanged assertion + a global-page confirm assertion. RED on
  `ODD_SUT=ref:main` (no dialog; per-entity stays stale), GREEN on the working-tree SUT. Add to `feature-complete`
  + `ui-e2e`.

**Scope EXCLUSIONS (G-C5):** no back-end change (BE persistence is correct); no defensive rewrite of the
now-activated reducer branch's `state.dataEntityAlerts[id].items` access (the per-entity tab always populates
`dataEntityAlerts[id]` before the button is clickable — no reachable NPE; verified, not deferred); no change to
the success-toast; no change to the global page's permission MODEL (only fold the existing check into onConfirm);
no touching other thunks (verified key-consistent). Adjacent issues → backlog via `follow-up-on-disk.md`, not this PR.

**Docs (G-C10):** read `documentation/.../alerting` + the alert-tab page; decide update-vs-"none + why". The fix
restores intended behaviour (no NEW user-facing capability) → likely `docs_routing: none` with the read-justified why.

**Ontology (G-C10):** `/enrich --touched` the alert UI flow sidecars once `lineage/**` is clean+unclaimed
(currently DIRTY+unowned — P-001 residue; R9/O10 → defer with justification if still dirty).

## Phase D — Implementation + Test / Docs / Ontology ledger

**Branch:** `contrib/CTRIB-034-alert-status-reflect-confirm` @ `987ebc5e` (worktree `../odd-platform-ctrib034`,
push-safe: `push.default=current`, no upstream — never main-tracked, O6/LSN-038). Diff = 11 files, FE-only
(no Java/backend, no openapi, no migration): `alerts.thunks.ts` (Defect 1, 1-line key) · `AlertItem.tsx` +
`DataEntityAlertItem.tsx` (Defect 2 ConfirmationDialog + `.unwrap()`) · 7 locale JSONs (+2 keys each) ·
`alerts.slice.test.ts` (new unit test).

**Static FE gates (node 24 via the gradle-node-plugin toolchain):**
- `tsc --noEmit` — **0 errors** (production + test).
- `eslint` (the 4 changed source files) — **0 problems**; `prettier --write` applied.
- `vitest run` (FULL FE suite) — **54 passed / 1 failed**; the single failure is the PRE-EXISTING **PLT-239**
  i18n-guard false-positive (`LinkedTermsList.tsx:63` — the guard regex false-matches the ternary
  `error.message : 'Unknown Error'`), unrelated to this change, RED on `origin/main`, **not CI-gated** (the PR
  Java gate runs `-PbundleUI=false`, no vitest). My new tests + the i18n key-parity + catalog-parity guards PASS.

**Full unit build — the odd-platform PR CI replica (`scripts/run-platform-tests.sh` = `:odd-platform-api:build
-PbundleUI=false` → test + checkstyleMain + checkstyleTest + assemble), against the worktree @ 987ebc5e:
BUILD SUCCESSFUL in 5m31s.** The PR Java gate runs `-PbundleUI=false`, so it does NOT build the FE — for this
zero-Java change it is green-by-construction (the Java is untouched); the FE compile + bundle is proven by the
SUT build that produced the 005dee4b image the full e2e regression ran green against.

**Unit bucket (odd-platform CI) — `alerts.slice.test.ts` (RED→GREEN):** runs the REAL `updateAlertStatus` thunk
(mocking only the API boundary) through the REAL reducer and asserts `state.dataEntityAlerts[id].items` reflects
the new status. A hand-crafted `.fulfilled({ entityId })` payload would PASS on the buggy system too (the reducer
is already correct — the bug is the thunk's key), so the test drives the thunk to exercise the emitted key
(G-C15). **RED on base** (`expected undefined to be 2001` — the thunk emits `dataEntityId`, so `payload.entityId`
is undefined) → **GREEN on the fix**. (The sibling "global path" assertion passes on both — Defect 1 is
per-entity-only.)

**Integration bucket (odd-team) — IT-142 (RED→GREEN), MANDATORY (user-facing FE/BE contradiction, LSN-031):**
new `integration-tests/protocols/IT-142-*.md` + `e2e/specs/alert-status-change.spec.ts` (3 tests: per-entity
reflect-without-refresh + confirm, cancel-gates-the-flip, global confirm). Added to `feature-complete` + `ui-e2e`.
- **RED proof** — `ODD_PLATFORM_IMAGE=odd-platform:0.0.1-SNAPSHOT` (digest 353a5b06 = current-main alert code,
  the alert UI unchanged since #1763) → **3/3 FAILED**, each on `getByRole('dialog')` never visible (Defect 2: no
  confirmation on the buggy system). Run-log `2026-06-24-IT-142.md`.
- **GREEN** — on the worktree-built SUT (`run-regression.sh ctrib034`, SUT from 987ebc5e) → IT-142 **3/3 PASSED**
  (per-entity reflect ✓ · cancel-gates ✓ · global confirm ✓).

**FULL regression (G-C2) — `run-regression.sh ctrib034`, SUT built once from the worktree @ 987ebc5e
(digest 005dee4b), flock-serialized, torn down — GREEN-for-change across all four buckets:**
- **feature-complete: 316 passed / 0 failed** (api:PASS e2e:PASS) — incl. **IT-142 3/3** + the merged-sibling specs
  (IT-037/IT-050/IT-137/IT-138/IT-139/IT-141 all green — every prior CTRIB fix is in my base 8e5b3339, so NO
  unmerged-fix deltas; a clean full green).
- **multi-stack: 9 passed / 0 failed** (e2e:PASS).
- **known-bugs: 3 failed** (e2e:FAIL) — the 3 EXPECTED-RED pins, **0 unexpected green** (no un-flipped fix).
- **ingestion-e2e: 6 passed / 0 failed** (e2e:PASS).
- Run-logs: `2026-06-24-{feature-complete,multi-stack,known-bugs,ingestion-e2e,IT-142}.md` (each carries the
  005dee4b SUT digest == the committed branch SHA 987ebc5e).

**Docs (G-C10 + G-C11) — routed to the release/0.29.0 TRAIN.** Read the live alerting page
(`documentation/docs/active-platform-features/alerting.md`); it published a **Known UX limitation** —
*"Clicking `Resolve` … immediately fires the status change — there is no confirmation dialog … an accidental
click destroys the audit history."* This fix makes that caveat FALSE at 0.29.0, so it is an **unreleased-behaviour**
correction → the `release/0.29.0` train (NOT docs `main`; the live manual still describes 0.28.0, which has no
dialog). Committed `documentation@release/0.29.0 ae43375` (rewrote the hint to describe the new safeguard +
in-place reflection, preserving the export-before-resolve advice for a *deliberate* resolve — the manual-resolve
retention bug is unchanged). Paired backlog **DOC-485** (`pending-release`, milestone 0.29.0, post-merge URL +
the Gate-8 release-gate checklist). (Defect 1's in-place reflection restores already-documented intent — line 13
"resolving an alert updates the same record in place" — so no separate correction needed there.)

**Ontology (G-C10) — DEFERRED with justification.** `lineage/**` is DIRTY + unowned (the P-001 probe-run residue,
2026-06-23 + 2026-06-24, no registered stream — R9 single-writer / O10 route-around). Running `/enrich --touched`
now would write into a dirty tree and risk sweeping the probe-run owner's work. Deferred to the next clean +
unclaimed window / the 0.29.0 release substrate scan — the same accepted bar as CTRIB-028/029/032/033. The touched
nodes are FE-only (no Java sidecars heavily affected); the alert UI flow sidecar refresh lands at the next scan.

**Principal sufficiency (G-C13).** Enough + meaningful tests: the unit test proves the per-entity in-place update
(the actual Defect-1 mechanism) RED→GREEN; IT-142 proves both surfaces' confirmation + the reflect-without-refresh
on a real browser, RED→GREEN. No control lost — the global page restructure REMOVED bespoke `isUpdating`/
`disableResolve`/`'No access!'` state in favour of the dialog's built-in loading/error (a net simplification),
folding the existing permission check into `onConfirm` with `.unwrap()`. The local **patch-coverage gate (jacoco
98% changed-files)** is **N/A** — the change touches ZERO Java; the FE is covered by the unit test + IT-142. UI
reviewed as a user (the Phase-B screenshots + the IT-142 GREEN run render the dialog + the in-place flip).

## Comments posted

## GATE 1 — APPROVED (2026-06-24, RamanDamayeu via AskUserQuestion)
- Defect 2 confirmation scope: **both surfaces** (per-entity tab + global page).
- Defect 1 fix side: **thunk-side** (emit `entityId`).
- No scope narrowing vs the issue → no mandatory scope comment (G-C5).

## Comments posted
A standalone root-cause/reproduction issue comment was drafted (scratchpad `issue-comment.md`) but its POST
was denied by the harness's outward-facing-write guard (the GATE-1 answers approved the design, not publishing
to the public issue). Decision: **do not** post a separate comment — fold the root-cause + live reproduction
into the **PR body** instead (it surfaces in the thread via `Closes #1803`). The only external writes then are
the branch push + the draft PR (Phase E), surfaced for authorization at handoff.
