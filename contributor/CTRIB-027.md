---
ctrib: CTRIB-027
github_issue_number: 1766
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1766
title: "Shared ConfirmationDialog swallows rejection → stuck spinner (mutateAsync arm) / silent-close (thunk arm)"
class: bug
scope: frontend
milestone: "0.29.0"          # open + semver → G-C11 PASSES (no hard stop)
status: done   # /review 2026-06-22 (opus-4-8, separate session) → ACCEPTED. Reviewer independently re-ran unit 49/49 + feature-complete 305/305 + IT-138 GREEN on the reviewed SUT 0df69b9d; all 17 criteria + G-C1..G-C16 + universal gates PASS (see ## Review). REMAINING HANDOVER (maintainer; odd-contributor App unconfigured): branch is already on origin — post the drafted scope comment to #1766 + open the DRAFT PR (Closes #1766; body = CTRIB-027-pr-body.md). GATE 2 human approve+merge owns merged/done; at merge flip F-031 H-005 mutateAsync facet to resolved. | RELEASE-GATE 0.29.0 residue closed 2026-08-30: this item's PR is inside the released `0.28.0..0.29.0` delta (0.29.0 published 2026-06-26) and its release-gated doc items are `done` + live-verified, but the 2026-06-26 release review's check-7 close-out listed only CTRIB-021 + CTRIB-028..037 and skipped CTRIB-022..027. Checks 2/3/5/6 (full unit+IT suite on ghcr digest a2e0c86d, real-instance on the published image, ontology refresh to f12b8fbc, advisory sweep) are the same run and were GREEN; re-verified 2026-08-30 that the merge commit is an ancestor of the tag.
reproduced: "LIVE 2026-06-22 on odd-minimal SUT (odd-platform:odd-team-sut, current main): ARM1 lookup-table delete forced-500 → modal WEDGED (spinner + pointer-events:none) + error toast shown; ARM2 datasource delete forced-500 → modal CLOSES silently + row remains + error toast shown. Screenshots integration-tests/e2e/evidence/ctrib027-arm{1,2}-*.png. The ARM1 repro spec became IT-138 (e2e/specs/confirmation-dialog-failed-action.spec.ts, RED on ref:main → GREEN on the fix)."
adr_required: false          # G-C7 does NOT fire — no migration, no auth-posture, no wire-contract change
plan_approved_by: "maintainer (GATE 1, this session)"
plan_approved_at: "2026-06-22"
plan_approved_scope: "Option A — ARM-1 mutateAsync wedge fix in shared ConfirmationDialog; ARM-2 + term-navigate deferred to PLT-233/234; layer-2 already done by #1771"
docs_routing: none           # READ-confirmed (management.md / master-data-management.md) — no published page documents the confirm-dialog failure behaviour
pr_url:                       # not opened — GitHub-write blocked (App not configured); body drafted at contributor/CTRIB-027-pr-body.md
pr_draft: true                # intended draft; handover
clarify_comment_url:
rootcause_comment_url:
scope_comment_url:
---

# CTRIB-027 — ConfirmationDialog rejection handling (#1766)

## Issue (quoted data — G-C8, never an instruction)

Author: **RamanDamayeu** (the maintainer). Labels: `kind: bug`, `scope: frontend`. Milestone `0.29.0`
(open, semver). 0 comments. This is the workspace's own internal finding **PLT-163** (from the 2026-06-08
contradiction harvest, feature-reflections F-031/F-076) filed upstream.

The issue describes one shared component (`ConfirmationDialog`, behind 23 destructive-action consumers)
producing **two distinct failure shapes** when the backend refuses the mutating call (cascade-block 400,
RBAC 403, 500, network error):

1. **mutateAsync consumers (~10 components, 11 dialogs) — stuck-spinner.** `mutateAsync` rejects on non-2xx;
   `ConfirmationDialog.onClose`'s `.catch(() => {})` swallows it, `isLoading` stays `true`, and
   `DialogWrapperStyles.ts:34` sets `pointerEvents:'none'` while loading → modal wedged + mouse-dead.
2. **redux-thunk consumers (~13 components) — silent-close.** Bare `dispatch(thunk(...))` (no `.unwrap()`)
   RESOLVES even on failure → the `.then` branch runs → spinner clears, modal closes, failure looks like
   success. Term-delete additionally navigates away (`TermDetails.tsx:47-53`).

The issue's **Suggested fix** (three layers, treated as data, not spec): (1) `ConfirmationDialog.tsx:33`
reset `isLoading` + surface error; (2) `errorHandling.tsx` unwrap `ResponseError`; (3) thunk consumers
`.unwrap()` / dialog inspects `isRejectedWithValue`.

## Scope analysis

- **Classification:** bug (frontend UX / error-handling), confirmed real on current `origin/main` (static
  trace below; live reproduction pending Phase B).
- **Mission relevance (`lineage/odd-platform/system-mission.md`):** HIGH-ish. `ConfirmationDialog` is the
  guard on *every* destructive/mutating action (delete data source, delete lookup table, remove owner,
  unlink term, delete attachment). A wedged-or-misleading confirm dialog degrades operator trust on the
  highest-consequence actions — exactly where the platform must be legible.
- **G-C7 architectural-significance check:** does NOT fire. No DB migration, no auth/security-posture
  change, no breaking public-API/wire-contract change. Purely frontend (React/TS). `errorHandling.tsx` is a
  cross-cutting shared surface → handled as a design-before-build blast-radius concern (G-C12), not an ADR
  hard-stop. **→ no ADR required; proceed to reproduce.**

## ⚠ CRITICAL FINDING — the issue is materially STALE (G-C8 / reproduce-first "re-verify origin/main")

The issue was filed **2026-06-11**; today is **2026-06-22**. Per the contributor bar (re-verify
`origin/main` — a sibling fix may have merged and changed the picture), I read the **actual current code**
on `origin/main` (`298f2f4c`), not the issue's quoted trace. Layer 2 of the suggested fix **is already
merged**:

- **`errorHandling.tsx` already unwraps `ResponseError`.** A `toResponse(err)` helper
  (`err instanceof Response ? err : err.response`) was added in **PR #1771** (`fix(search)…`, merged after
  the issue was filed). BOTH `getErrorResponse` and `showServerErrorToast` now route through it. The
  issue's claim *"no FE code unwraps `.response` anywhere… the toast is never shown"* is **false on current
  main.** `errorHandling.tsx:14-18,62`.
- **Consequence — both arms now show an error toast on failure:**
  - mutateAsync arm → the **global mutation `onError`** (`index.tsx:44-45`) fires `showServerErrorToast` →
    now unwraps → toast renders. (`useDeleteLookupTable` has `onSuccess` only, no suppressing `onError`.)
  - thunk arm → `handleResponseThunk.ts:37-39` fires `showServerErrorToast` (no `switchOffErrorMessage` on
    `deleteDataSource`) → now unwraps → toast renders.

**So the remaining, still-real defects (post-#1771) are narrower than the issue states:**

| Arm | Still broken on main? | Now mitigated by #1771? |
|---|---|---|
| **1 — mutateAsync stuck-spinner** | **YES** — `ConfirmationDialog.tsx:33` `.catch(() => {})` still swallows; modal wedged + pointer-dead. The worst symptom (no mouse recovery). | An error toast now appears, but the modal is still frozen — toast does not unfreeze it. |
| **2 — thunk silent-close** | **YES** — dispatch resolves → modal closes as if success; term-delete navigates away. | An error toast now appears, so failure is **no longer invisible** — materially lowers severity. |
| **— no-toast-anywhere** | **NO — fixed by #1771.** | n/a (drop from scope). |

This re-scoping + severity re-assessment is a **GATE-1 decision for the maintainer** (G-C16) — see the Plan.

## Static root-cause (verified against current `origin/main`)

- **The swallow (arm 1):** `ConfirmationDialog.tsx:25-35` — `action().then(clear+close).catch(() => {})`.
  On a rejecting `mutateAsync`, `isLoading` is never reset.
- **The mouse-lock:** `DialogWrapperStyles.ts:34` — `pointerEvents: $isLoading ? 'none' : 'all'`.
- **The reuse opportunity:** `DialogWrapper` **already** has an `errorText?: string` prop that renders an
  inline error region (`DialogWrapper.tsx:25,42,123-127` via `S.ErrorText`). `ConfirmationDialog` wraps
  `DialogWrapper` but never passes it. The "inline error region" the issue's layer-1 asks for **already
  exists** — wire it, don't build it (G-C12 reuse).
- **The thunk semantics (arm 2):** `handleResponseThunk.ts:24-43` resolves via `rejectWithValue` (a
  resolved rejected-action); a bare `dispatch(...)` without `.unwrap()` therefore resolves on failure.
  `DataSourceItem.tsx:31`, `TermDetails.tsx:47-53` (the navigate-away).
- **`ResponseError`:** `runtime.ts` — `class ResponseError extends Error { constructor(public response:
  Response …) }`, thrown on non-2xx by `request()`. `.response` is the real `Response`. Confirmed.

## Reproduction log (Phase B)

Driven live on the running system (reproduce-first / LSN-031 — a rendered-state UX bug is invisible to a
static trace). Stack: `odd-minimal` (AUTH_TYPE=DISABLED, synthetic admin) running `odd-platform:odd-team-sut`
(current main, has #1771). Failure forced via Playwright route-interception (`fulfill 500`) — any backend
refusal reproduces it (cascade-block 400 / RBAC 403 / 500 / network). Spec:
`integration-tests/e2e/specs/_repro-ctrib027.spec.ts` (scratch — becomes the Phase-D IT).

**ARM 1 — mutateAsync (lookup-table delete), `2 passed`:** click Delete → confirm → the DELETE 500s →
the dialog **stays open**, the `LinearProgress` spinner **keeps running**, the dialog root computes
`pointer-events: none` (mouse-dead), AND the red error toast renders. Screenshot:
`integration-tests/e2e/evidence/ctrib027-arm1-wedged.png` — the wedged "Are you sure you want to delete
this lookup table?" modal with the spinner bar + the "Forced 500 (CTRIB-027 repro)" toast.

**ARM 2 — thunk (datasource delete):** click Delete → confirm → the DELETE 500s → the dialog **closes as
if it succeeded**, the datasource row **remains** in the list, AND the red error toast renders. Screenshot:
`integration-tests/e2e/evidence/ctrib027-arm2-silent-close.png` — no modal, `ct027_ds_target` still listed,
the "Forced 500 DS (CTRIB-027 repro)" toast.

**Both arms empirically confirm the STALE finding:** the error toast **does** appear on each path now —
the issue's *"no error toast appears on either path"* is false on current main (fixed by #1771). The
residual, still-real defects are: ARM 1 the **wedged modal** (toast does not unfreeze it; no mouse
recovery), ARM 2 the **silent close** (toast is now the only failure signal; the modal closing + the
term-delete navigate-away still misreport failure as success).

## Root-cause comment (posted to issue)

_pending Phase B._

## Plan (GATE 1 artifact)

### G-C16 — Change-request product analysis (is the WHAT right?)

**User-observable problem, restated independent of the issue's proposed 3-layer fix:** when an operator
confirms a destructive action and the backend refuses it, the shared dialog **misreports** the outcome —
either it **freezes** (mutateAsync arm: spinner forever, mouse-dead, no recovery but reload) or it **closes
as if it succeeded** (thunk arm; term-delete even navigates away as if deleted). A confirm-and-mutate dialog
must never freeze and never present failure as success.

**Product reasoning (PO/SRE lens, reasoned explicitly — this is a standard error-UX correctness call within
FE expertise, not an ODD-domain question, so no `odd-sme` consult):** the platform's own guardrails
(cascade-block `USR004`, RBAC denial) trigger these paths in *normal* operation, so the failed-confirm path
is a first-class state, not an edge case. The correct behaviour on a failed destructive confirm: (a) stop
the spinner, (b) keep the dialog open so the user can read the error and retry/cancel, (c) show the reason.

**What changed since the issue was filed (the decisive product input): #1771 already shipped layer 2.**
Both arms now render an error toast on failure (reproduced live). So the issue's premise — *"both failure
shapes are invisible"* — is **no longer true**. The residual severity is:
- **ARM 1 wedge — still HIGH.** A frozen, mouse-dead modal with no recovery. The toast does not unfreeze it.
- **ARM 2 silent-close — now MEDIUM (was high).** The toast makes failure visible; the residual wart is the
  modal closing (looks like success) — bad on a destructive action, but no longer a *silent* failure.
- **term-delete navigate-away — still a real (narrow) defect:** navigates to term-search as if deleted,
  contradicting the error toast. One consumer (`TermDetails.tsx`).

**Options (incl. rescope/revoke), each with its consequence:**
- **A — fix ARM 1 in the shared dialog; defer ARM 2 + term-navigate (RECOMMENDED).** Resolves the
  highest-severity, no-recovery defect in ONE shared file, reusing an existing affordance, zero consumer
  churn. ARM 2 (toast-mitigated by #1771) + term-navigate become tracked follow-ups. Tightest, safest,
  first-time-right.
- **C — A + also fix ARM 2 now** by converting the ~12 bare-`dispatch(thunk)` consumers to the codebase's
  established `.unwrap()` idiom (so they reject-on-failure and flow through the same fixed `.catch`). Closes
  the issue's generic ask in one PR; larger diff (~13 files), broader regression surface across 12
  destructive surfaces. term-navigate still its own follow-up.
- **Revoke layer 2** — already done by #1771; drop from scope entirely (note on the issue).
- **(rejected) dialog inspects `isRejectedWithValue`** — would fix ARM 2 in one file BUT introduces a pattern
  used nowhere + a `@reduxjs/toolkit` import into a `shared/elements` component that is currently
  redux-free; the idiomatic codebase fix for a thunk is consumer `.unwrap()` (used across the Autocompletes),
  so this is the *less* consistent choice. Rejected in favour of C-if-ARM2.

**Recommendation: Option A.** The wedge is the headline defect and the only no-recovery one; #1771 de-risked
ARM 2; G-C5 scope discipline + "subtract before you add" favour the bounded change. **This is the GATE-1
decision** (A vs C) — surfaced, not silently absorbed.

### G-C12 — Design before build

- **Reuse-scan (no new components):**
  - `DialogWrapper` **already** exposes an `errorText?: string` prop that renders an inline error region via
    `S.ErrorText` (`DialogWrapper.tsx:25,42,123-127`). The dialog's `formSubmitHandler` already flows through
    it. → **Reuse it** for the inline error; do NOT build a new error region (the issue's layer-1 "inline
    error region" already exists).
  - `getErrorResponse(err)` (`errorHandling.tsx:20`, already `ResponseError`-unwrapping post-#1771) → reuse
    to extract the human message from the caught rejection. No new error-parsing.
  - No new component, helper, hook, or endpoint. (LSN-035 reuse gate satisfied.)
- **ADR-check:** no ADR governs FE error-handling/dialogs (`implicit-adrs.md` — zero hits). The
  toast-via-`showServerErrorToast` + `.unwrap()`-in-consumers convention is an *emerging* pattern but small;
  not worth a reverse-engineered ADR for this change. **No ADR proposed; G-C7 does not fire.**
- **Impact-dimension checklist:**
  - **i18n — NONE.** The inline error reuses the server message / the existing `'An error occurred'` fallback
    (already in `errorHandling.tsx`, English, not keyed). No new static UI string → no `t()` key → no change
    to any of the 7 locales (`en/br/es/fr/ch/ua/hy`). (If review prefers a translated generic label instead
    of the raw server message, that adds 7 locale entries — flagged, not silently deferred.)
  - **generated clients — N/A** (no OpenAPI/contract change).
  - **every consumer — backward-compatible.** All 23 `ConfirmationDialog` consumers: the change only affects
    the **rejected-`onConfirm`** path (mutateAsync arm); the success path and the thunk resolve path are
    unchanged → no consumer regresses. `errorText` is an existing optional prop.
  - **migration — N/A** (no schema/default change).
  - **docs — none (read-confirmed in Phase D, G-C10).** This is internal FE error-UX; no
    `docs.opendatadiscovery.org` page documents "what the confirm dialog does on a failed delete." Will READ
    the candidate area before asserting. `docs_routing: none`.
  - **ontology** — re-enrich the touched nodes (`ConfirmationDialog`, `DialogWrapper`) + refresh `F-031` /
    `F-076` reflections (the use_case whose contradiction surfaced this bug), committed (G-C10).
  - **tests** — both buckets (below).
- **PO/SRE lens:** delivered (a)(b)(c) above; the fix makes the failed-confirm path legible and recoverable.
- **Look at the pixels (Phase D):** after building, screenshot the failed-delete dialog (spinner gone,
  inline error legible via `S.ErrorText color='error'`, dialog usable) and review as a user before "done".

### The exact change (Option A)

`odd-platform-ui/src/components/shared/elements/ConfirmationDialog/ConfirmationDialog.tsx`:
- Add `const [errorText, setErrorText] = React.useState<string>()`.
- Replace `.catch(() => {})` with a handler that: `setIsLoading(false)`, derives the message via
  `getErrorResponse(err)` (reuse), `setErrorText(message)`, and **keeps the dialog open** (does NOT call
  `handleClose`).
- Clear `errorText` when a new confirm starts (in the `setIsLoading(true)` branch) and on unmount (extend the
  existing cleanup effect).
- Pass `errorText` to `DialogWrapper` (the prop already exists and already renders).
- Net: a rejected confirm → spinner stops, dialog stays open, the reason shows inline; the global toast
  (post-#1771) also shows. No mouse-lock (pointerEvents returns to `all` once `isLoading` is false).

### Scope EXCLUSIONS (deliberately NOT touched — G-C5)

1. **ARM 2 generic thunk silent-close** (~12 bare-`dispatch(thunk)` consumers, e.g. `DataSourceItem`,
   `EditableNamespaceItem`, `RoleItem`, …). Now toast-mitigated by #1771. Idiomatic fix = consumer
   `.unwrap()` across 12 files → **deferred to PLT-233** (logged on disk in Phase D), named in the scope
   comment. (Included only if the maintainer picks Option C.)
2. **term-delete navigate-away** (`TermDetails.tsx:47-53` chains `.then(navigate)` onto the always-resolving
   dispatch). Consumer-level fix (`.unwrap()` before navigate) → **deferred to PLT-234** / fold into PLT-128
   (the DataSource-arm sibling). Named in the scope comment.
3. **errorHandling `ResponseError` unwrap (issue layer 2)** — already shipped in #1771. No action.
4. No refactor of the 23-consumer call pattern, no new toast policy, no `DialogWrapper` redesign.

### ADR decision

None required (G-C7 does not fire; no ADR governs the area; the change conforms to existing FE patterns).

### Test plan (BOTH buckets — G-C9)

- **Unit (odd-platform CI, `./gradlew build`):** new
  `components/shared/elements/ConfirmationDialog/__tests__/ConfirmationDialog.test.tsx` (RTL — pattern exists
  in sibling `__tests__/`). Render with an `onConfirm` that **rejects** (explicit failing condition); click
  confirm; assert: spinner/loading cleared, dialog still open, `errorText` rendered. A second case: an
  `onConfirm` that **resolves** → dialog closes (success path unchanged). FAILS on current main (the `.catch`
  swallow leaves it loading / no error) → PASSES on the fix.
- **Integration (odd-team `IT-138`, e2e):** convert `_repro-ctrib027.spec.ts` ARM-1 into
  `integration-tests/protocols/IT-138-confirmation-dialog-failed-action.md` + `e2e/specs/…`. Assert the
  **FIXED** behaviour: after a forced-500 delete, the dialog is **not wedged** (spinner gone,
  `pointer-events` restored, inline error shown, dialog closeable). **RED on `ODD_SUT=ref:main`** (wedged) →
  **GREEN on the working-tree fix.** `gates: validates: [F-058], regresses: [PLT-163]`.

### Docs decision + routing

`docs_routing: none` — internal FE error-UX, no published page describes it (read-confirmed in Phase D
before asserting, G-C10). No release-train DOC item.

### Ontology refresh (G-C10)

`/enrich --touched` on `ConfirmationDialog` + `DialogWrapper`; refresh `F-031` / `F-076` reflections (the
use_case coverage the fix changes). Committed, not narrated.

### Drafted scope comment (posts to the issue AFTER GATE 1, before any code — G-C5)

> **Status + scope (odd-team contributor run).** Re-verified against `origin/main`: **layer 2 of the
> suggested fix already shipped in #1771** — `showServerErrorToast`/`getErrorResponse` now unwrap the
> generated client's `ResponseError`, so **both arms now render an error toast on failure** (confirmed by
> driving the running UI). The issue's "no error toast appears on either path" no longer holds.
>
> This PR fixes the **highest-severity residual: the stuck-spinner (mutateAsync) arm** — the shared
> `ConfirmationDialog` now clears its loading state and surfaces the error inline (reusing `DialogWrapper`'s
> existing `errorText`) instead of swallowing the rejection, so the modal no longer freezes mouse-dead.
>
> Deliberately **out of this PR** (tracked separately): the redux-thunk **silent-close** arm (now
> toast-mitigated; idiomatic fix is `.unwrap()` across ~12 consumers) and the **term-delete navigate-away**
> (`TermDetails`) — both follow-ups. Layer 2 needs no further action.

_(If the maintainer picks Option C, the comment is updated to state both arms are fixed here, and only the
term-navigate is deferred.)_

## Test / doc / ontology ledger (Phase D)

**⚠ GitHub-write blocker (recorded, non-blocking for engineering):** the `odd-contributor` GitHub App is
NOT configured in this environment (`GH_APP_ID`/`GH_INSTALLATION_ID`/key all unset). Per
`playbooks/github-write.md` on-fail, do NOT fall back to a PAT. Therefore the bot cannot post the scope
comment, push the branch, or open the draft PR here. Decision: do ALL local engineering (branch local,
implement, both test buckets, ontology, docs), and hand the GitHub actions to the maintainer at Phase E
(configure the App → I post/push, OR run the prepared scope comment + branch push + manual PR URL by hand).
The "scope comment before any code" invariant is preserved at the public layer — nothing becomes public
until the maintainer runs the GitHub steps, and the scope comment is handed over to post first.

### Implementation
- Branch (local): `contrib/CTRIB-027-confirmationdialog-rejection` from `origin/main` (298f2f4c).
- **Fix:** `odd-platform-ui/src/components/shared/elements/ConfirmationDialog/ConfirmationDialog.tsx` — the
  `.catch(() => {})` swallow → a handler that `setIsLoading(false)` + `getErrorResponse(err)` → `setErrorText`,
  keeping the dialog open; `errorText` wired to `DialogWrapper`'s existing `errorText` prop; the unmount
  cleanup also resets `errorText`; `errorText` cleared at the start of each confirm. (4 edits, 1 file.)
- **Diff is clean:** only `ConfirmationDialog.tsx` (M) + the new test (`??`). `generated-sources` is
  gitignored (build artifact). The pre-existing untracked `docker/demo.override.yaml` is NOT mine — not staged.

### Unit test (odd-platform CI bucket) — `ConfirmationDialog/__tests__/ConfirmationDialog.test.tsx` (NEW)
- 3 tests (RTL, vitest): (1) rejected confirm with a server message → inline error shown + dialog stays
  open; (2) rejected confirm, no message → 'An error occurred' fallback + stays open; (3) resolved confirm
  → dialog closes (success path unchanged). The failing condition (a rejecting `onConfirm`) is injected
  explicitly. Wraps the tree in `MuiThemeProvider` (the shared `render` helper omits it; the design-system
  Button needs `theme.palette.button.*`).
- **GREEN on the fix; RED proof on base:** reverted just the component fix (kept the test) → tests 1&2 FAIL
  (swallow → no inline error), test 3 PASSES (success path). Restored. A valid RED→GREEN discriminator.
- **No regression:** full vitest suite **49/49 passed** (14 files, incl. the 3 new).
- **Lint:** `eslint` on both files → **0 errors** (prettier auto-fixed). **Typecheck:** 0 tsc errors in the
  touched files; the ~50 full-project tsc errors are PRE-EXISTING stale gitignored `generated-sources`
  (recent `LOOKUP_TABLE_RENAMED`/Alerts/`ML_MODEL` not yet regenerated) — resolved by the build's
  `pnpm generate` step (confirmed: the SUT build regenerated them), unrelated to this change.
- Runner: local Node 24.13.0 (installed to `~/.local/node`, the version `node-gradle` pins) — the env's
  default Node 18 cannot load vite 7's ESM config.

### Integration test (odd-team IT bucket) — IT-138
- Protocol `integration-tests/protocols/IT-138-confirmation-dialog-failed-action.md` + spec
  `e2e/specs/confirmation-dialog-failed-action.spec.ts`; added to `suites.yaml` (`feature-complete`, `ui-e2e`).
  `gates: validates [F-058], regresses [PLT-163]`. Asserts the FIXED behaviour (dialog open + inline error +
  spinner cleared + `pointer-events:all`). Scratch repro spec removed.
- **Run ledger (working-tree SUT, built from the fix; digest c89454…):**
  - `ODD_SUT=working run-suite.sh IT-138` → **e2e:PASS** (GREEN on the fix). The full UI build
    (`pnpm generate && tsc && vite build`) succeeded → post-generate typecheck clean with my change.
    Recovered-dialog screenshot reviewed (pixel review, G-C12 step 5): spinner gone, inline error legible in
    red above the action button, X-close reachable → `e2e/test-results/ctrib027-arm1-recovered.png`.
  - `ODD_SUT=ref:main run-suite.sh IT-138` → **e2e:FAIL** (RED on pre-fix `main @ 298f2f4c`), failing at
    "the server reason must be surfaced inline" — the swallow. Valid RED→GREEN guard.
- **FULL integration regression (G-C2)** against the working-tree SUT (`odd-platform:odd-team-sut`, the fix):
  - **`feature-complete` → e2e 305/305 PASS (5.6m), ZERO failures** — the shared-component blast-radius is
    clean (every ConfirmationDialog consumer surface: datasource-management, cascade-on-delete, lookup-tables,
    owner-association, query-examples, attachments + my IT-138, all green). The run also reported `api:FAIL`
    — investigated: **NOT a regression.** The lone api probe (P-001 view-count) could not START —
    `FATAL: PyYAML required` — because the probe-runtime uv project (`lineage/_extractor`) declared only
    `ruamel.yaml`, while `probe-runtime/runner.py` uses the PyYAML API (latent gap, surfaces on a clean env;
    the 2026-06-11 run had pyyaml ambiently). A FE ConfirmationDialog edit cannot affect a backend probe.
    **Fixed** (declared `pyyaml>=6` in the extractor pyproject + installed in the venv); the api rail runs in
    the suites below.
  - **`multi-stack` → e2e:PASS** (9 specs; MinIO/LOGIN_FORM/LDAP/notifications own-stack).
  - **`known-bugs` → 3 RED = exactly the expected pins** (IT-004 PLT-052, IT-006 TEST-GAP-1013, IT-007
    LSN-001/PLT-086) — **NO unexpected GREEN** (my change neither broke nor un-flippedly-fixed any).
  - **`ingestion-e2e` → 6/6 PASS** (IT-128 relationships pipeline, 57.7s).
  - **api rail re-confirmed:** after declaring pyyaml+requests, `IT-001`/P-001 (view-count delta) → **api:PASS**
    — proving the earlier `api:FAIL` was purely the dep gap, not a view-count regression.
  - Runner note: reused the already-built `odd-platform:odd-team-sut` (no rebuilds) via `ODD_PLATFORM_IMAGE`.

### Principal sufficiency (G-C13) + the patch-coverage gate
- **Patch-coverage gate:** the odd-platform `min-coverage-changed-files: 98` gate is **JaCoCo = backend Java
  only** (`run-pr-tests.yaml:85`, "Backend Coverage"). This change touches **zero `.java`** → the gate is
  **N/A**. The FE coverage provider (`@vitest/coverage-v8`) is not even a declared devDep (no hard FE
  coverage gate). Every new TS line IS exercised by the unit test: the start-clear `setErrorText(undefined)`,
  the `.catch` branch (tests 1&2), the success-close (test 3), the unmount cleanup (afterEach). No untested
  new code path.
- **Enough + meaningful tests?** Yes — both buckets, both RED→GREEN-proven; the success path is pinned so a
  future regression of the un-swallow is caught.
- **Control lost / functionality harmed?** No — one shared file, +1 state + the existing `errorText` prop;
  the success path and the thunk resolve path are untouched; 305/305 + multi-stack + ingestion all green.
- **UI pixel review (G-C12 step 5):** done — the recovered dialog is legible (red inline error above the
  action button, no spinner, X reachable).

### Tooling fix (discovered during the mandated regression — `playbooks/follow-up-on-disk.md`)
The probe-runtime (`lineage/_extractor/probe-runtime/runner.py`) imports the PyYAML + requests APIs but
`pyproject.toml` declared only `ruamel.yaml` — a latent gap that FATAL-ed the api rail on a clean env.
**Fixed in-line** (additive, workspace-internal): declared `pyyaml>=6` + `requests>=2.31` and installed them
in the venv. Not a follow-up — a 2-line repair of a broken tool I had to run.

### Docs (G-C10) — `docs_routing: none` (READ-confirmed)
Read `documentation/docs/management.md` (+ `master-data-management.md`): they document WHICH Management
actions exist ("remove a source", "regenerate/revoke a token") but NOT the confirm-dialog behaviour, and
nothing about the failure path. The fix changes only the previously-undocumented failure UX (success path
unchanged), so there is no published claim to update. No release-train DOC item.

### Ontology (G-C10) — targeted + release-gated (the CTRIB-023 pattern), committed
`ConfirmationDialog.tsx` / `DialogWrapper.tsx` are NOT substrate nodes (no per-node sidecars), so
`/enrich --touched` has nothing to refresh. The bug is described in the **F-031 H-005** reflection (use_case
`ui_confirmationdialog_swallows_rejection_modal_stuck_loading_no_recovery`) + the 2026-06-08 harvest. I
annotated `F-031.yaml` H-005 with a `release_gated_update` block that (a) records the in-flight CTRIB-027
fix (mutateAsync stuck-spinner, flips `resolved` at 0.29.0, guarded by IT-138), and (b) **corrects a factual
error**: H-005 described the DataSource (thunk) arm as stuck-spinner, but that arm SILENT-CLOSES — the
stuck-spinner is mutateAsync-only (matches #1766's 2026-06-10 correction + the live repro). The flip to
`resolved` is release-gated (not premature — main still swallows). F-076 H-003 also references the class
(noted; flips with the same release). No graph re-embed needed for a YAML annotation (batch-refresh model,
per CTRIB-023). **Merge-time action:** at #1766 merge, flip the F-031 H-005 mutateAsync facet + the harvest
row to resolved.

## Review (2026-06-22, session: opus-4-8 · max effort · separate `/review` session · reject-by-default)

- **Result**: **ACCEPTED** → `pr-draft` → `review-ready`. The human GATE-2 merge owns `merged`/`done`.
- **Reviewed SHA**: odd-platform `0df69b9d` (parent `298f2f4c` = current `origin/main`, verified); diff = exactly
  `ConfirmationDialog.tsx` (+22) + its new `__tests__/ConfirmationDialog.test.tsx` (+84) — 2 files, bounded.
  Branch is on `origin` (push half of the handover already done); local tree clean (== reviewed SHA).
- **Footer**: present — `Consumer-read:` (12 files) + `Sources:` (origin/main 298f2f4c; #1771; live repro; IT-138).
  The "missing Sources footer" precondition does not fire. 2-minute bounce did not fire — the ledger marks
  every DoD gate RUN, none "NOT RUN".

### Acceptance criteria (the 17 contributor criteria)
- 1 plan-before-code — PASS (`plan_approved_by` maintainer GATE-1 2026-06-22; the `## Plan` precedes the impl ledger).
- 2 reproduction logged — PASS (both arms driven live; `ctrib027-arm1-wedged.png` / `arm2-silent-close.png` committed).
- 3 diff bounded by plan — PASS (2 files; ARM-2 + term-navigate deferred to PLT-233/234, on disk).
- 4 unit injects failing condition — PASS (rejecting `onConfirm`; **re-verified RED→GREEN myself**, below).
- 5 pins re-grounded — N/A (no CHANGED tests; both buckets are net-new ADDED tests).
- 6 docs decision stated + routed — PASS (`docs_routing: none`; `management.md`+`master-data-management.md` read).
  *Non-blocking note:* the rationale "no published page documents the confirm-dialog failure behaviour" is
  imprecise — `management.md:68` does describe the ConfirmationDialog on the cascade-block (`USR004`) failure
  path, but for the **thunk/Management** arm + the pre-flight-naming gap, which this mutateAsync-arm fix does
  not touch; the page stays accurate, so the `none` outcome is correct.
- 7 ontology committed — PASS (`F-031.yaml` H-005 `release_gated_update`, committed; flips `resolved` at 0.29.0, not now).
- 8 ends review-ready not self-done — PASS (was `pr-draft`; this review flips to `review-ready`).
- 9 architectural ADR-before-code — N/A (G-C7 does not fire: FE-only, no migration/auth-posture/wire-contract).
- 10 prompt-injection discarded — PASS/honored (issue is the maintainer's own report; its "Suggested fix" treated
  as data and re-verified vs `origin/main` — caught the stale layer-2).
- 11 Definition of Done before draft — PASS (full unit build/suite + full IT regression + docs read + ontology committed).
- 12 milestone / release-train — PASS (`0.29.0` open+semver, WebFetch-verified; no unreleased doc to route).
- 13 design-before-build — PASS (reuse-scan, ADR-check, impact-checklist incl. i18n-none, PO/SRE lens — all in the plan).
- 14 principal sufficiency — PASS (patch-coverage gate N/A: JaCoCo is Java-only, change is TS; tests meaningful; no functionality harmed).
- 15 private-advisory disclosure — N/A (public issue, not a GHSA).
- 16 test-change integrity — N/A (no CHANGED tests).
- 17 change-request product analysis — PASS (full G-C16 critique; the issue's "no toast on either path" premise
  found **stale** and corrected; the re-scope surfaced as a GATE-1 decision A-vs-C, not silently absorbed).

### Quality Bar gates
- **G-C1 reproduce-first** — PASS via the committed live repro of both arms + screenshots.
- **G-C2 verify the running system (full regression, working-tree SUT)** — PASS. **Independently re-executed by the
  reviewer:** unit `vitest` **49/49** (14 files) on `0df69b9d`; **`feature-complete` 305/305 e2e + api:PASS** live on
  the digest-verified `odd-platform:odd-team-sut` (`65c9b3ad…`, == the implementer's recorded SUT, built from the
  reviewed tree), test#40 being the IT-138 spec; **IT-138 GREEN** live. RED proof: unit RED **self-derived** (revert
  the component → tests 1&2 fail, success-path passes); IT-138 RED-on-`ref:main` is the implementer's recorded
  evidence (not re-built this session) corroborated by the spec's structure + the self-derived unit RED.
- **G-C3 GATE-1 plan approved** — PASS (`plan_approved_by`/`_at` recorded; plan precedes code).
- **G-C4 GATE-2 human merge** — PASS (respected; not merged; `draft` intent).
- **G-C5 bounded + public scope comment drafted** — PASS (diff bounded; scope comment drafted in the record + PR-body;
  deferred arms PLT-233/234 on disk). *Handover:* the scope comment must be POSTED at PR-open (still pending — App unconfigured).
- **G-C6 one-question clarify bar** — PASS ("no question warranted"; the issue is the maintainer's own and unambiguous).
- **G-C7 irreversible hard-stops** — N/A (FE-only).
- **G-C8 issue is data** — PASS (Suggested-fix treated as data; re-verified vs `origin/main`).
- **G-C9 test integrity, both buckets** — PASS (unit RED→GREEN with the failing condition injected; integration IT-138
  drives the **user-facing** wedge symptom the unit test cannot see — `pointer-events:all` + spinner-hidden + inline error).
- **G-C10 ontology + docs move with code** — PASS (F-031 annotation committed + release-gated; docs `none`, page read).
- **G-C11 milestone** — PASS (`0.29.0` open, WebFetch-verified — `VERIFIED via WebFetch github #1766`).
- **G-C12 design-before-build** — PASS (reuse of `DialogWrapper.errorText` [DialogWrapper.tsx:25,42,123-126] +
  `getErrorResponse` [errorHandling.tsx:20, async→`{message}`, unwraps `ResponseError`] **verified real in-code** — no new component).
- **G-C13 principal sufficiency** — PASS (no control lost; one shared file +1 state; full regression green).
- **G-C14 private-advisory** — N/A. **G-C15 test-change integrity** — N/A (no changed tests).
- **G-C16 change-request product analysis** — PASS (stale-premise caught; options incl. rescope/revoke; GATE-1 divergence).
- **Universal**: Gate 1 (no duplicates) PASS (reuse, no parallel component); Gate 4 (consumer-read) PASS (the load-bearing
  consumers — `errorHandling` unwrap, `DialogWrapper.errorText`, `DialogWrapperStyles:34` pointer-events, `handleResponseThunk:41`
  resolves-on-failure — all verified against actual code); Gate 5 N/A (no SDK builder); Gate 6 PASS (the user-visible change has no
  published page; thunk-arm `management.md:68` unchanged); Gate 9 PASS (Sources cross-checked: parent SHA verified, #1771 unwrap
  WebFetch-verified, #1766 milestone verified); Gate 10/11 N/A (no doc authoring).
- **Outbound URL sweep**: 2 URLs verified via WebFetch — `github.com/.../issues/1766` (open, milestone `0.29.0`, author RamanDamayeu,
  labels kind:bug/scope:frontend) and `github.com/.../pull/1771` (merged 2026-06-11, adds the `ResponseError`→`.response` unwrap). 0 mismatches, 0 broken.
- **Banned-phrase check**: none used.
- **Regressions**: none. Unit 49/49 (self-run) · feature-complete 305/305 + api:PASS (self-run, live) · IT-138 GREEN (self-run, live).
  `multi-stack` 9/9 + `known-bugs` 3-expected-RED + `ingestion-e2e` 6/6 accepted from the implementer's committed run-logs on the
  digest-verified SUT (topically orthogonal to a FE ConfirmationDialog change; not re-executed this session).
- **Navigation**: consistent — no bean-factory/SDK-builder discovered; FE-only change, no `navigation/domains` update needed.
- **Upstream issues logged**: none (the deferred arms PLT-233/PLT-234 were already filed by `/implement`).
- **Doc-product editorial findings** (audit ran per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: focused partition on the destructive-confirm / Management surface (`management.md`,
    `master-data-management.md`) — the subtree conceptually nearest the reviewed change. Full-tree baseline = the
    2026-06-08 comprehensive editorial audit (`DOC-336..439`, 104 items pending at the Backlog Review Gate). Other
    subtrees deferred to the next `/review` (not skipped silently — see partition note).
  - **Findings**: none new surfaced. *Observation (not a finding, no DOC item — already tracked):* `management.md:68`'s
    general "the UI's ConfirmationDialog … does not name the conditional outcome" will become arm-specific once the
    destructive-confirm bug class fully resolves (CTRIB-027 mutateAsync arm at 0.29.0 + PLT-233 thunk arm + PLT-128
    pre-flight); it is accurate today and the revisit is owned by PLT-233/PLT-128 — no new item (LSN-009 grep-first; over-log avoided).
- **GitHub-write handover (still the maintainer's action — `odd-contributor` App unconfigured)**: the upstream branch
  `contrib/CTRIB-027-confirmationdialog-rejection` @ `0df69b9d` is already on `origin`; remaining: **post the drafted
  scope comment to issue #1766** (G-C5 public-bounding) and **open the DRAFT PR** (`Closes #1766`, body =
  `contributor/CTRIB-027-pr-body.md`). Then GATE-2 (human approve + merge) owns `merged`/`done`; at merge, flip the
  F-031 H-005 mutateAsync facet + the harvest row to `resolved`.
- **Notes**: review left the repo read-only — the two live runs appended run-logs + the api-rail merged values into
  `lineage/**`; all reverted (`git checkout`), only the pre-existing untracked `probe-runs/2026-06-22-P-001.yaml`
  remains, exactly as at session start. VERIFIED via `git status` clean post-revert. The api-rail PyYAML/requests dep
  fold-in (`lineage/_extractor/pyproject.toml`) is a legitimate "fix the broken tool you had to run" — confirmed working
  (my feature-complete run got api:PASS) — VERIFIED via the live run, not scope-creep into the odd-platform PR.
