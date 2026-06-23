---
ctrib: CTRIB-031
github_issue_number: 1766
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1766
title: "ConfirmationDialog ARM-2 (redux-thunk): a refused destructive confirm closes-as-success / term-delete navigates away — finish #1766"
class: bug
scope: frontend
milestone: "0.29.0"          # open + semver (verified via GitHub API) → G-C11 PASSES (no hard stop)
status: pr-draft             # 2026-06-23 REWORK DONE (maintainer-directed): IT renumbered IT-139→IT-141 (collision RESOLVED — run-suite.sh IT-139 now uniquely globs CTRIB-028's term-linked-columns; IT-141 globs this one) + RED→GREEN RE-PROVEN under IT-141 on the two CACHED images (GREEN 56f54a05 2/2; RED 8615e9ed 2/2-fail as-expected — no rebuild). .tsx fix byte-unchanged (branch @ a2a71af5; PR #1801 unaffected). Hand-off = pr-draft; a FRESH /review (separate session) confirms pr-draft→review-ready, then human GATE-2 merge. See "## Rework (2026-06-23)" below. ─── BOUNCE HISTORY: /review REJECTED → blocked; the blocker was IT-139 id COLLISION — CTRIB-031 reused `IT-139`, already taken 21h earlier by CTRIB-028's term-linked-columns-pagination IT (commit 436b695); run-suite.sh:81 `ls IT-139-*.md | head -1` → CTRIB-031's spec (alphabetically first) silently SHADOWS CTRIB-028's F-153/PLT-058 test (no longer runnable by id). CODE + TESTS verified CORRECT (fix mechanism, Gate-4 completeness, unit 4/4 GREEN on the reviewer's own vitest run, IT-139 RED→GREEN corroborated via the committed Playwright artifacts showing genuine bug symptoms, G-C15 clean on the one changed spec). REWORK = renumber the IT to IT-141 + re-run under the new id (the .tsx code needs no change). Full verdict: "## Review (2026-06-23)" below.
# Prior hand-off note (pre-review, retained): Phase D COMPLETE — Unit RED→GREEN, IT-139 RED→GREEN (both arms), feature-complete 311/311 (ledger), known-bugs 3-RED-as-expected (ledger), docs read (none), ontology committed, pixel-reviewed; multi-stack + ingestion-e2e maintainer-approved FE-only skip; branch PUSHED + scope comment + DRAFT PR #1801. NB the implementer set status straight to `review-ready`; contributor items hand off at `pr-draft` (review flips pr-draft→review-ready on PASS).
reproduced: >-
  ARM-2 thunk silent-close: CITED from CTRIB-027's same-day LIVE reproduction (2026-06-22, current-main SUT) —
  datasource delete forced-500 → modal closes-as-success + the row remains + an error toast appears
  (integration-tests/e2e/evidence/ctrib027-arm2-silent-close.png). The thunk failure path
  (handleResponseThunk.ts:41 rejectWithValue → the dispatch promise RESOLVES; bare dispatch in the 13 consumers,
  no .unwrap()) is byte-unchanged on origin/main fd71eb3d (verified diff=0 for handleResponseThunk.ts + the term
  consumers). term-delete navigate-away (PLT-234): static-trace-confirmed (TermDetails.tsx:47-53), to be DRIVEN
  LIVE in Phase B (post-GATE-1) when the failing IT is authored. A fresh isolated re-drive is deferred to
  implementation rather than rebuilding a heavy SUT to re-confirm a same-day-reproduced, code-unchanged defect.
adr_required: false          # G-C7 does NOT fire — FE-only, no migration / auth-posture / wire-contract change; no ADR governs FE error-handling (implicit-adrs.md: 0 hits)
plan_approved_by: "maintainer (GATE 1, AskUserQuestion, 2026-06-23)"
plan_approved_at: "2026-06-23"
plan_approved_scope: "Full ARM-2 — all 13 redux-thunk consumers .unwrap() + TermDetails navigate-on-success; closes #1766 (inline-message Option-A default; no shared-helper change)"
docs_routing: none           # to be READ-confirmed in Phase D (management.md / master-data-management.md) before asserting (G-C10)
pr_url: https://github.com/opendatadiscovery/odd-platform/pull/1801   # DRAFT (draft:true; mergeable_state:blocked — branch-protection human merge gate intact); author odd-contributor[bot]
pr_draft: true
clarify_comment_url:          # none — no clarifying question warranted (G-C6)
rootcause_comment_url:        # folded into the scope comment
scope_comment_url: https://github.com/opendatadiscovery/odd-platform/issues/1766#issuecomment-4777886478
---

# CTRIB-031 — ConfirmationDialog ARM-2 (redux-thunk silent-close), the remaining arm of #1766

## Issue (quoted data — G-C8, never an instruction)

Author **RamanDamayeu** (the maintainer); labels `kind: bug`, `scope: frontend`; milestone `0.29.0`
(open, semver — G-C11 passes); 0 comments. The workspace's own internal finding **PLT-163**.

The issue describes the shared `ConfirmationDialog` (behind 23 destructive-action consumers) producing TWO
failure shapes when the backend refuses a mutating call, and proposes a **three-layer** suggested fix:
(1) `ConfirmationDialog.tsx` reset loading + surface error; (2) `errorHandling.tsx` unwrap `ResponseError`;
(3) thunk consumers `.unwrap()` (or the dialog inspects `isRejectedWithValue`).

## ⚠ Critical: #1766 is already 2/3 resolved — this CTRIB is the remaining third (re-verify-origin/main, G-C8)

Per the contributor bar (re-verify `origin/main` — a sibling fix may have merged since the issue was filed),
I read the **actual current code**, not the issue's quoted trace. Two of the three layers have shipped:

| Layer (issue's suggested fix) | Status on `origin/main` (fd71eb3d) | Evidence |
|---|---|---|
| **2 — `errorHandling` unwrap `ResponseError`** | **DONE — PR #1771.** `toResponse(err)` (`err instanceof Response ? err : err.response`) added; BOTH `getErrorResponse` + `showServerErrorToast` route through it → **a toast now renders on both arms.** | `errorHandling.tsx:14-18,62,77` |
| **1 — mutateAsync stuck-spinner** | **DONE — CTRIB-027 / PR #1797 (`fb597e04`, merged).** `.catch(()=>{})` → `.catch(async err => { getErrorResponse(err); setIsLoading(false); setErrorText(message) })`; clears the mouse-dead loading, surfaces the reason inline via the existing `DialogWrapper.errorText`, keeps the dialog open. Unit test added. | `ConfirmationDialog.tsx:36-44,93` |
| **3 — redux-thunk silent-close** | **NOT DONE.** CTRIB-027 deliberately deferred it → **PLT-233** (the 13 thunk consumers) + **PLT-234** (term navigate-away). The issue stays **open** because of this. | `issues/odd-platform/PLT-233.md`, `PLT-234.md` |

The literal bug in the issue body ("`.catch(()=>{})` does nothing", "no error toast appears on either path")
is **stale** — that code is gone and the toast now fires. **CTRIB-031 = layer 3** (the issue's own first-choice
fix: consumer `.unwrap()`), which finally closes #1766.

## Scope analysis

- **Classification:** bug (frontend UX / error-handling). Real on current `origin/main` (static trace + the
  CTRIB-027 live reproduction below).
- **Mission relevance (`lineage/odd-platform/system-mission.md`):** HIGH-ish. `ConfirmationDialog` guards
  *every* destructive/mutating action; presenting a refused destructive action as a success (modal closes; for
  term-delete, navigates away as if deleted) is exactly the legibility failure the platform must not have.
- **G-C7 architectural-significance:** does NOT fire. No DB migration, no auth/security-posture change, no
  breaking public-API/wire-contract change. Pure frontend (React/TS). No ADR governs FE error-handling
  (`lineage/odd-platform/implicit-adrs.md`: 0 hits for thunk/error-handling/dialog). **→ no ADR; proceed.**

## Root-cause (verified against current `origin/main` — consumer-read, Gate 4)

- **The thunk semantics:** `handleResponseAsyncThunk` (`redux/lib/handleResponseThunk.ts:24-42`) catches the
  API error, fires `showServerErrorToast` (now works, #1771), and `return thunkAPI.rejectWithValue(errResp)`.
  A redux-toolkit dispatch promise **RESOLVES** on a rejected-action.
- **The 13 consumers** pass a **bare** `dispatch(thunk(...))` to `onConfirm` (no `.unwrap()`), so on failure
  the promise resolves → `ConfirmationDialog.onClose`'s `.then` branch runs → `setIsLoading(false)` +
  `handleClose()` → **the modal closes exactly as on success.** (`ConfirmationDialog.tsx:32-35`.)
- **The sharpest instance (PLT-234):** `TermDetails.tsx:47-53` chains `.then(() => navigate(termsSearch))`
  onto the always-resolving dispatch → a refused term delete **navigates away as if the term were deleted**,
  contradicting the error toast.
- The shared `ConfirmationDialog` `.catch` (post-#1797) already does the right thing on a **rejection** — but
  a thunk consumer never rejects. **The fix belongs in the consumers**, not the (already-fixed) shared dialog.

### The 13 thunk consumers (the ARM-2 corpus — all verified `dispatch(...)`, `mut=0`)

| # | File | onConfirm handler | Action |
|---|---|---|---|
| 1 | `Management/RolesList/RoleItem/RoleItem.tsx:28` | `handleDelete` | delete role |
| 2 | `Management/OwnersList/EditableOwnerItem/EditableOwnerItem.tsx:28` | `handleDelete` | delete owner |
| 3 | `Management/NamespaceList/EditableNamespaceItem/EditableNamespaceItem.tsx:22` | `handleDelete` | delete namespace |
| 4 | `Management/DataSourcesList/DataSourceItem/DataSourceItem.tsx:31` | `onDelete` | delete data source |
| 5 | `Management/PolicyList/PolicyItem/PolicyItem.tsx:26` | `handleDelete` | delete policy |
| 6 | `Management/CollectorsList/CollectorItem/CollectorItemToken/CollectorItemToken.tsx:29` | `onTokenRegenerate` | regenerate collector token |
| 7 | `Management/TagsList/EditableTagItem/EditableTagItem.tsx:22` | `handleDelete` | delete tag |
| 8 | `Management/CollectorsList/CollectorItem/CollectorItem.tsx:30` | `onDelete` | delete collector |
| 9 | `Management/DataSourcesList/DataSourceItem/DataSourceItemToken/DataSourceItemToken.tsx:29` | `onTokenRegenerate` | regenerate data-source token |
| 10 | `Terms/TermDetails/Overview/OverviewGeneral/OverviewGeneral.tsx:31` | `handleOwnershipDelete` | delete term ownership |
| 11 | `DataEntityDetails/Overview/OverviewMetadata/MetadataItem/MetadataItem.tsx:58` | `handleDelete` (NOT `handleUpdate`) | delete custom metadata |
| 12 | `DataEntityDetails/Overview/OverviewGeneral/OwnersSection/OwnershipDeleteForm/OwnershipDeleteForm.tsx:26` | `handleOwnershipDelete` | delete entity ownership |
| 13 | `DataEntityDetails/TestReport/.../SelectableSeverity/SelectableSeverity.tsx:40` | `handleConfirm(severity)` | set QA-test severity (non-delete mutation) |
| + | `Terms/TermDetails/TermDetails.tsx:47-53` | `handleTermDelete` (passed to `TermDetailsHeader`) | delete term **+ navigate** (PLT-234) |

All 13 are the identical pattern `const handleX = (…) => () => dispatch(someThunk({…}))`. The 10 **mutateAsync**
consumers (lookup-table / attachment / query-example / owner-association) are **out of scope** — already
handled by #1797's `.catch`.

## Reproduction (Phase B) — G-C1

- **ARM-2 generic silent-close:** reproduced LIVE by CTRIB-027 same-day on a current-main SUT — datasource
  delete forced-500 → the modal closed, the row remained, the error toast appeared. Evidence committed:
  `integration-tests/e2e/evidence/ctrib027-arm2-silent-close.png`. The thunk path is byte-unchanged since
  (verified diff=0). This is the G-C1 evidence for the plan.
- **term-delete navigate-away (PLT-234):** static-trace-confirmed only (`user_facing_verified: false`); the
  mechanism is identical (always-resolving dispatch + unconditional `.then`). **Will be DRIVEN LIVE in Phase B**
  when the failing IT is authored against the running system (the not-yet-driven facet).

## Plan (GATE 1 artifact)

### G-C16 — Change-request product analysis (is the WHAT right, before the HOW?)

**User-observable problem, restated independent of the issue's proposed fix:** when an operator confirms a
destructive/mutating action on any of the 13 redux-thunk surfaces and the backend refuses it (cascade-block
`USR004`, RBAC 403, 500, network), the shared dialog **closes as if the action succeeded** — and for term
delete it **navigates to term-search as if the term were deleted**. An error toast now appears (post-#1771),
so failure is *visible*, but the modal-closing + the navigate-away actively **mis-signal success** on the
highest-consequence actions, contradicting the toast.

**Product reasoning (PO/SRE lens — a standard error-UX correctness call within FE expertise, not an
ODD-domain question, so no `odd-sme` consult):** a confirm-and-mutate dialog must never present failure as
success. The platform's own guardrails trigger these refusals in *normal* operation, so the failed-confirm
path is first-class. The correct behaviour on failure = keep the dialog open so the user sees it didn't happen
and can retry/cancel — **exactly what #1797 already gave the mutateAsync arm.** Parity across all confirm
surfaces is the product-right outcome.

**Options (incl. rescope / revoke), each with its consequence:**
- **A — `.unwrap()` all 13 thunk consumers + gate the term-navigate (RECOMMENDED).** The issue's own
  first-choice layer-3 fix and the codebase's established idiom (`.unwrap()` at 25 existing call-sites,
  prominently the Autocompletes). A uniform 1-line edit per consumer; flows every failure through the
  already-fixed shared `.catch`. **Closes #1766.** Diff is broad-but-shallow (~14 files); regression covered by
  the full e2e suite.
- **B — central fix: `ConfirmationDialog` inspects `isRejectedWithValue` (REJECTED).** One file, but couples a
  generic `shared/elements` component to `@reduxjs/toolkit` (which it does not import) and introduces a pattern
  used nowhere — *less* consistent than the established consumer `.unwrap()`.
- **C — bounded subset (deletes only; defer token-regenerate #6/#9 + severity #13).** Smaller diff, but leaves
  some confirm surfaces silently closing-as-success while others don't — an inconsistent half-fix; does not
  close #1766.
- **Revoke layer-2** — already done by #1771; dropped from scope (noted in the scope comment).

**Recommendation: Option A.** It is the issue's own endorsed shape, the idiomatic codebase fix, and the only
option that makes the dialog honest on *every* confirm surface and closes the issue.

**Divergence surfaced (the GATE-1 decision):** none from the issue's *ask* (A implements its layer-3 verbatim).
The only reframe is **severity: the residual is MEDIUM, not the filed HIGH** — #1771's toast already removed
the "silent/invisible" property; the residual wart is the false-success close + the term navigate-away. This
is the maintainer's call to accept at GATE 1, not silently absorbed.

### G-C12 — Design before build

- **Reuse-scan (no new code):** reuse (a) the **already-fixed `ConfirmationDialog` `.catch`** (clears loading +
  inline error + stays open on a rejection — `ConfirmationDialog.tsx:36-44`); (b) the **established `.unwrap()`
  idiom** (25 call-sites). **Zero** new component / helper / hook / endpoint. (LSN-035 reuse gate satisfied.)
- **ADR-check:** no ADR governs FE error-handling/dialogs (`implicit-adrs.md`: 0 hits). The
  `.unwrap()`-in-consumers + toast-via-`handleResponseThunk` convention is established and small; not worth a
  reverse-engineered ADR (matches CTRIB-027's call). **No ADR; G-C7 does not fire.**
- **Impact-dimension checklist:**
  - **i18n — NONE.** No new user-facing string. The inline error reuses the server message / the existing
    `'An error occurred'` fallback (already English, not keyed in `errorHandling.tsx`). No `t()` key → **no
    change to any of the 7 locales** (`en/br/es/fr/ch/ua/hy`).
  - **generated clients — N/A** (no OpenAPI/contract change).
  - **every consumer — bounded + backward-compatible.** The 13 thunk consumers change only their **failure**
    path; the success path is identical (`.unwrap()` resolves the same payload on 2xx). The shared
    `ConfirmationDialog` / `DialogWrapper` / `errorHandling` are **untouched** → the 10 mutateAsync consumers
    are unaffected.
  - **migration — N/A.**
  - **docs — `none`, READ-confirmed in Phase D** (G-C10): internal FE error-UX; `management.md:68` mentions the
    ConfirmationDialog on the cascade-block path but does not document the failure-close behaviour — re-read
    before asserting. No release-train DOC item.
  - **ontology** — refresh `F-031` H-005 (the use_case this bug surfaced from; CTRIB-027 already noted "THIS
    [thunk] arm is the actual surface H-005 describes"); flip its DataSource-arm facet `resolved` at the 0.29.0
    release, committed (G-C10).
  - **tests** — both buckets (below).
- **PO/SRE lens:** delivered above — the fix makes every destructive-confirm legible + honest on failure
  (parity with the mutateAsync arm).
- **Look at the pixels (Phase D):** screenshot the failed datasource-delete dialog (stays open, inline error,
  spinner gone) and verify a failed term-delete **stays on the term page** — reviewed as a user before "done".

### The inline-message design wrinkle (decided, not asked — within-expertise default)

A thunk `.unwrap()` throws the `rejectWithValue` payload — an **already-parsed `AppError` `{status,message,…}`**,
not a `ResponseError` — so `ConfirmationDialog`'s `getErrorResponse(err)` finds no `.response` and the **inline**
message falls back to generic `'An error occurred'`, while the **toast** (from `handleResponseThunk`) shows the
specific server message. **Decision: accept this (Option-A default).** The user already gets the specific reason
(toast) + an honest open dialog (inline); this matches how a network error already renders on the mutateAsync
arm, and it touches no shared helper. The alternative (enhance `getErrorResponse` to surface an `AppError`'s
message for a specific inline) risks the existing CTRIB-027 test (`Error('network down')` expects the generic
fallback) and widens the blast radius across all 23 consumers for marginal gain — **not done**; logged as a
possible later polish, not a blocker.

### The exact change (Option A)

1. **12 plain consumers** (#1–#13 except TermDetails): append `.unwrap()` to the dispatched thunk in the
   `onConfirm` handler, e.g. `() => dispatch(deleteRole({ roleId }))` → `() => dispatch(deleteRole({ roleId })).unwrap()`.
   `onConfirm`'s `() => Promise<unknown>` contract is preserved (`.unwrap()` returns a `Promise`). For
   `MetadataItem`, only `handleDelete` (the ConfirmationDialog onConfirm), **not** `handleUpdate`.
2. **`TermDetails.tsx:47-53` (PLT-234):** gate the navigate on success —
   `dispatch(deleteTerm({ termId: id })).unwrap().then(() => navigate(termsSearchPath(termSearchId)))`
   (or the `async/await` form). On failure the `.then(navigate)` does not run; the rejection flows to the
   dialog's inline error + the toast; a successful delete still navigates (behaviour preserved).
- **Net behaviour:** a refused thunk confirm → the dialog **stays open** with an inline error (generic) + the
  specific toast; the row remains; term delete **does not navigate**. The success path is unchanged.

### Scope EXCLUSIONS (deliberately NOT touched — G-C5)

1. The **10 mutateAsync consumers** — already correct post-#1797. No touch.
2. **`ConfirmationDialog.tsx` / `DialogWrapper.tsx` / `errorHandling.tsx`** — already fixed (#1797 / #1771). No
   change (including the inline-message wrinkle above — deliberately not enhancing `getErrorResponse`).
3. **PLT-128** (DataSource-specific pre-flight/forewarning UX) — a distinct UX ask, stays its own item.
4. No refactor of the 23-consumer call pattern; no new toast policy; no shared-component redesign.

### ADR decision
None required (G-C7 does not fire; no ADR governs the area; the change conforms to the existing `.unwrap()` idiom).

### Test plan (BOTH buckets — G-C9)

- **Unit (odd-platform CI, `./gradlew build` → vitest):**
  1. **Representative consumer** — `DataSourceItem` (the PLT-128 sibling): render with the test-helper redux
     store (`testHelpers.tsx` provides `Provider`+store), mock the `deleteDataSource` API to reject, click
     Delete → Confirm, assert the dialog **stays open** (title still present) + the row is not treated as
     deleted. **RED on main** (bare dispatch resolves → dialog closes) → **GREEN on the fix**. The failing
     condition (a rejecting API) is injected explicitly.
  2. **`TermDetails` navigate-gating (PLT-234)** — mock `deleteTerm` to reject; assert `navigate` is **not**
     called on failure, **is** called on success. **RED on main** (navigate called unconditionally) → **GREEN**.
- **Integration (odd-team — new `IT-139`, sibling to IT-138; the symptom is user-facing → MANDATORY, G-C9):**
  reuse the IT-138 forced-500 route-intercept harness. Drive a **thunk-arm** delete (datasource) → assert the
  dialog **does NOT close-as-success** (stays open + inline error; row remains). Drive a **term** delete →
  assert **no navigate-away** (still on the term page) + inline error. **RED on `ODD_SUT=ref:main`**
  (closes-as-success / navigates) → **GREEN on the working-tree fix.** `gates: validates [F-031], regresses
  [PLT-233, PLT-234]`. (IT-138 is tightly scoped to the mutateAsync *un-wedge* — a different assertion — so a
  sibling IT-139 is the right modelling rather than overloading IT-138.)

### Docs decision + routing
`docs_routing: none` — internal FE error-UX; no published page documents the confirm-dialog failure-close
behaviour. READ-confirm `management.md` + `master-data-management.md` in Phase D before asserting (G-C10). No
release-train DOC item.

### Ontology refresh (G-C10)
`ConfirmationDialog`/consumers are not substrate nodes (CTRIB-027 confirmed `/enrich --touched` has nothing to
refresh). Update `lineage/odd-platform/feature-reflections/detail/F-031.yaml` H-005's `release_gated_update`:
record the thunk-arm fix (the actual DataSource surface H-005 describes) and flip its facet `resolved` at the
0.29.0 release (not now — main still silent-closes). Committed, not narrated. F-076 H-003 references the class
(noted; flips with the same release).

### Drafted scope comment (posts to the issue AFTER GATE 1, before any code — G-C5)

> **Status + scope (odd-team contributor run — completing #1766).** Re-verified against `origin/main`: two of
> the three suggested-fix layers already shipped — **layer 2** (`ResponseError` unwrap → an error toast now
> renders on both arms) in **#1771**, and **layer 1** (the mutateAsync stuck-spinner) in **#1797**. This PR
> completes the issue with **layer 3 — the redux-thunk arm**: the ~13 `ConfirmationDialog` consumers that pass
> a bare `dispatch(thunk(...))` now `.unwrap()` it, so a refused destructive confirm flows through the same
> path #1797 fixed — the dialog stays open with the error instead of **closing as if it succeeded**; and term
> delete no longer **navigates away as if the term were deleted** when the delete fails.
>
> With layer 2 in place the residual severity is **medium** (failure was already visible via the toast; the
> residual is the false-success close + the term navigate-away). Closes #1766. (Tracked internally as
> PLT-233 / PLT-234; PLT-128 — DataSource pre-flight UX — remains its own item.)

## Phase D progress + RESUME POINT (2026-06-23 — code-complete checkpoint, verification PENDING)

> **Why paused:** the FE unit tests need `node_modules` + `generated-sources`, which a fresh isolated
> worktree does not have. The maintainer is building proper parallel-stream isolated-env infra in a separate
> session and instructed: log everything so a later session resumes from here. The code change is DONE; only
> local verification + finalisation remain.

### ✅ DONE — the implementation (committed, NOT pushed)

- **Worktree:** `../odd-platform-ctrib031` — branch `contrib/CTRIB-031-confirmationdialog-thunk-arm`, base
  `origin/main` **fd71eb3d**, **no upstream** (push-safety OK, O6/LSN-038). Push.default=current on the clone.
- **Checkpoint commit:** `932fcd51` (`fix(ui): ConfirmationDialog thunk consumers .unwrap() …`). Carries the
  full `Consumer-read:` + `Sources:` footers. **Marked `[CHECKPOINT — tests pending]` in the body.**
- **The diff (13 files, verified):** `.unwrap()` appended to the `onConfirm` dispatch in **12** thunk
  consumers, + `TermDetails.tsx` navigate gated on `.unwrap().then(...)`:
  RoleItem · EditableOwnerItem · EditableNamespaceItem · DataSourceItem · PolicyItem · CollectorItem ·
  CollectorItemToken · DataSourceItemToken · EditableTagItem · terms/OverviewGeneral · MetadataItem
  (`handleDelete` only) · OwnershipDeleteForm · **TermDetails** (navigate-on-success).
- **Consumer-read findings (Gate 4) that changed the plan's count from 13 → 12:**
  - **`SelectableSeverity.tsx` already had `.unwrap()`** (added in `#1750`, the entity-status pattern) →
    **left untouched** (already correct). Fresh in-repo precedent that consumer-`.unwrap()` is the idiom.
  - **`MetadataItem.handleUpdate`** (the edit-FORM submit, not a `ConfirmationDialog`) has the SAME
    silent-success shape (`dispatch(thunk).then(() => setEditMode(false))` on failure) → **out of scope**,
    logged as **`issues/odd-platform/PLT-238.md`** (G-C5). NOT touched in this PR.
- **No change** to the shared `ConfirmationDialog` / `DialogWrapper` / `errorHandling` (already fixed by
  #1797 / #1771). The inline-message Option-A default holds (generic inline + specific toast).

### ⛔ REMAINING — exact resume steps (each must actually RUN before the PR leaves draft — G-C2/G-C9/G-C13)

0. **Set up the isolated FE env** (the blocker). The worktree needs `node_modules` + `src/generated-sources`.
   Use **Node 24** (`~/.local/node/bin`, default Node 18 cannot load vite 7). The symlink-from-shared approach
   (`ln -s ../../odd-platform/odd-platform-ui/node_modules`, `… src/generated-sources`) was DENIED this
   session pending the maintainer's isolated-env infra — use whatever that infra provides (or `corepack pnpm
   install` in the worktree). prettier `printWidth: 90`; run **`pnpm format` + `pnpm lint:fix`** on the 13
   touched files first (one line, `OwnershipDeleteForm` `.unwrap()` line, is 91 cols → prettier will wrap it).
1. **Unit tests (vitest, odd-platform CI bucket) — author + prove RED→GREEN, then run the full suite:**
   - **(a) `DataSourceItem`** — render with the test-helper store (`lib/tests/testHelpers.tsx` provides
     `Provider`+store+QueryClient+Theme), mock `deleteDataSource` to **reject**, click Delete → Confirm,
     assert the dialog **stays open** (title still present). **RED on base** (revert `.unwrap()` → bare
     dispatch resolves → dialog closes) → **GREEN on fix**. Inject the failing condition explicitly.
   - **(b) `TermDetails`** — mock `deleteTerm` to reject; assert `navigate` is **NOT** called on failure, IS
     called on success. **RED on base** (navigate called unconditionally) → **GREEN**.
   - Prove RED by reverting just the component edit (keep the test), as CTRIB-027 did. Then full vitest suite
     green (no regression). Pattern reference: the existing `ConfirmationDialog/__tests__/ConfirmationDialog.test.tsx`
     (from #1797) for the rejecting-`onConfirm` + `MuiThemeProvider` setup.
2. **Integration `IT-139` (odd-team, NEW — MANDATORY, user-facing symptom):** reuse the IT-138 forced-500
   route-intercept harness (`integration-tests/protocols/IT-138-*.md` + `e2e/specs/confirmation-dialog-failed-action.spec.ts`).
   New protocol `integration-tests/protocols/IT-139-confirmation-dialog-thunk-arm.md` + spec. Drive **datasource
   delete** (thunk) forced-500 → assert dialog **does NOT close-as-success** (stays open + inline error; the
   row remains). Drive **term delete** forced-500 → assert **no navigate-away** (still on the term page) +
   inline error (**this is the not-yet-driven PLT-234 facet** — drive it live here). `gates: validates [F-031],
   regresses [PLT-233, PLT-234]`; add to `suites.yaml` (feature-complete, ui-e2e). **RED on `ODD_SUT=ref:main`
   → GREEN on the working-tree SUT** (`odd-platform:odd-team-sut-ctrib031`, ports 18100/15452).
3. **FULL integration regression (G-C2)** on the working-tree SUT (serialized e2e; register `wants: e2e`,
   queue behind any live run): `run-suite.sh feature-complete` (green) + `multi-stack` (green) + `known-bugs`
   (expected RED, no unexpected GREEN) + `ingestion-e2e` (green). Read actual pass/fail counts. Build SUT into
   the per-stream tag `odd-platform:odd-team-sut-ctrib031` (NOT the shared tag).
4. **Docs (G-C10):** READ `documentation/docs/management.md` + `master-data-management.md` → confirm
   `docs_routing: none` (CTRIB-027 found `management.md:68` mentions the dialog on the cascade-block path but
   not the failure-close behaviour; re-confirm). No release-train DOC item expected.
5. **Ontology (G-C10):** update `lineage/odd-platform/feature-reflections/detail/F-031.yaml` H-005's
   `release_gated_update` — record the thunk-arm fix (the actual DataSource surface H-005 describes); flip its
   facet `resolved` at the 0.29.0 release (NOT now — main still silent-closes). YAML annotation only (no
   substrate node; `/enrich --touched` has nothing). Commit it.
6. **Principal sufficiency (G-C13):** patch-coverage gate is JaCoCo = **Java-only** → **N/A** (this is all TS).
   Confirm enough/meaningful tests, no control lost, no functionality harmed (the full regression is the
   measurement). **Pixel review (G-C12 step 5):** screenshot the failed datasource-delete dialog (stays open +
   inline error) and confirm a failed term-delete stays on the term page.
7. **Finalise → review-ready (NEVER self-done):** flip CTRIB-031 `status: review-ready`; write
   `contributor/CTRIB-031-pr-body.md` (`Closes #1766`, root-cause + the 13-file change + scope-exclusions +
   test evidence + `Milestone: 0.29.0` + `Docs: none`). Update the `ctrib031` stream entry. The DoD checklist
   (full unit build + full integration regression + docs read + ontology committed + sufficiency) must ALL be
   recorded as actually-RUN before leaving draft.
8. **Amend/replace the checkpoint commit** `932fcd51` if needed (drop the `[CHECKPOINT]` marker once tests are
   green; or add the test files as additional commits on the branch).

### Test / doc / ontology ledger — RESUMED + RUN 2026-06-23 (FE env unblocked via clean `pnpm@9 install` in the worktree + generated-sources copy; integration via the merged ODD_STREAM isolation tooling)

Branch rewritten to a clean state (was `932fcd51 [CHECKPOINT]`): **`e1fce6c1`** (fix, 13 files, reformat folded,
no CHECKPOINT) + **`a2a71af5`** (the 2 unit tests). NOT pushed.

- Unit (vitest, odd-platform CI bucket): **GREEN — RED→GREEN proven.**
  - `DataSourceItem.test.tsx` — rejected `deleteDataSource` → dialog STAYS OPEN (+ generic inline error); RESOLVED → closes. RED on a reverted `.unwrap()` (the "stays open" test failed → dialog closed-as-success), GREEN on the fix.
  - `TermDetails.test.tsx` — rejected `deleteTerm` → `navigate` NOT called (PLT-234); RESOLVED → navigates. RED on reverted `.unwrap()`, GREEN on the fix.
  - Full vitest suite GREEN except **one PRE-EXISTING, unrelated** failure (`i18n-key-parity` guard false-positives on the ternary `error.message : 'Unknown Error'` in `LinkedTermsList.tsx:63`, from #1798 — NOT my files, NOT CI-gated). Logged → `issues/odd-platform/PLT-239.md`.
  - `tsc --noEmit` GREEN; eslint + prettier clean on all touched + new files.
- Integration `IT-139` (NEW — `protocols/IT-139-confirmation-dialog-thunk-arm.md` + `e2e/specs/confirmation-dialog-thunk-arm.spec.ts`; registered in `suites.yaml` feature-complete + ui-e2e): **AUTHORED + RUN, RED→GREEN proven on the working-tree SUT.**
  - **GREEN** on `working` (`odd-platform:odd-team-sut-ctrib031`, digest `56f54a05`, built from the working tree @ `a2a71af5`), isolated stream ctrib031 on 18100/15452: both tests PASS — datasource dialog stays open; **term delete does NOT navigate away** (PLT-234 driven LIVE — the not-yet-driven facet, now driven).
  - **RED** on `ODD_SUT=ref:main` (`fd71eb3d`, isolated stream ctrib031base on 18110/15462): both FAIL exactly as the bugs predict — datasource dialog **closed** (close-as-success); term URL navigated to `…/termsearch/…` instead of `/terms/{id}`.
  - Tooling fix made en route: `run-suite.sh` now exports `ODD_DB_URL` from the stream's `ODD_DB_PORT` (the e2e db.ts seed helpers were hardcoded to the shared :15432 — the isolation gap that ECONNREFUSED'd the first run). Completes the per-stream isolation the runner.py + Playwright base URL already had.
- Full regression (G-C2, working-tree SUT `odd-platform:odd-team-sut-ctrib031`, isolated stream):
  - **feature-complete: 311/311 GREEN** (api:PASS e2e:PASS; run-log `2026-06-23-feature-complete.md`). NB the first run was 310/311 — the 1 failure was `advisory-lock-registry.spec.ts` hard-coding its DB CONN to the shared `:15432` (ECONNREFUSED under isolation), NOT my change; fixed to respect `ODD_DB_URL` and the re-run is clean 311/311.
  - **known-bugs: 3-RED-as-expected** (IT-004 PLT-052 DQ-crash · IT-006 TEST-GAP-1013 no-error-boundary · IT-007 LSN-001/PLT-086 attachment-durability) — **no unexpected GREEN** (my change flipped no known-bug pin).
  - **multi-stack + ingestion-e2e: maintainer-approved FE-only SKIP** (AskUserQuestion 2026-06-23 → "Accept FE-only reasoning"). These test backend HA/MinIO/LDAP/WAL-failover + the real collector ingestion pipeline — the backend jar is byte-identical to `main` (only the bundled SPA changed), so a FE-only change has zero blast radius there; and the per-session isolation tooling isn't ready for their own stacks (the advisory-lock hard-coding above is symptomatic). Flagged for the maintainer's GATE-2 env if belt-and-suspenders is wanted.
- Docs read (G-C10): **DONE → `docs_routing: none`, well-grounded.** `management.md:85` ALREADY documents "the dialog stays open with the cancel option highlighted" for the owner/namespace/datasource cascade-block deletes — i.e. the THUNK consumers this fix corrects. On the released 0.28.x the thunk arm closes-as-success (the PLT-233 bug), so the live doc currently over-claims for these three; the fix (0.29.0) brings the code into conformance with the already-published claim. No new/changed page, no train item. `master-data-management.md` has no confirm/delete content.
- Ontology (G-C10): **DONE.** `feature-reflections/detail/F-031.yaml` H-005 `release_gated_update` item (5) records the thunk-arm fix (flips `resolved` at 0.29.0); `F-076.yaml` H-003 gets a cross-referenced `release_gated_update` (same class; canonical record = F-031 H-005). YAML-only; committed at finalization. (Lineage tree carries an UNOWNED maintainer probe-run residue `2026-06-23-P-001` — left untouched; only F-031/F-076 staged.)
- Reproduction (Phase B): ARM-2 silent-close cited from CTRIB-027; **term-navigate (PLT-234) now DRIVEN LIVE** in IT-139 (RED on ref:main shows the `…/termsearch/…` navigate-away; GREEN on the fix stays on `/terms/{id}`).

### GitHub-write — DONE (Phase E, via the odd-contributor App)
**Correction:** the earlier "App NOT configured" note was WRONG — it checked the shell env (`GH_APP_ID`
unset there), but `scripts/gh-app/*` **auto-source `~/.config/odd-contributor/env`** (present, with
`key.pem`). `verify-app.sh` confirmed the token + EXACT scopes (`contents/issues/pull_requests=write,
metadata=read`). The writes were performed (1-hour token, never logged/committed; no `main` write):
- **Scope comment** → https://github.com/opendatadiscovery/odd-platform/issues/1766#issuecomment-4777886478
  (public-clean — workspace-internal `PLT-`/`CTRIB-` ids stripped per the playbook).
- **Branch pushed** `contrib/CTRIB-031-confirmationdialog-thunk-arm` @ `a2a71af5` (explicit same-name
  refspec `refs/heads/X:refs/heads/X`; `main` untouched — LSN-038 guard held).
- **DRAFT PR #1801** → https://github.com/opendatadiscovery/odd-platform/pull/1801
  (`draft:true`, `Closes #1766`, base `main`, author `odd-contributor[bot]`, `mergeable_state:blocked`).
GATE 2 = the human maintainer reviews (`/review` in a separate session) + approves + merges (the bot is
the PR author → cannot self-approve). At merge: flip F-031 H-005's thunk facet `resolved` + close #1766.

## Review (2026-06-23, session: review-ctrib031 — separate session, read-only on the repos)

- **Result: REJECTED → `blocked`.** Single blocker: the **IT-139 id collision** (below). The fix code and
  both test buckets are independently verified **correct** — the `.tsx` change needs no rework; only the IT
  bookkeeping does.

### Reviewer's independent verification (not trusting the ledger)

- **Fix mechanism — CORRECT (read the code):** `handleResponseThunk.ts:24-42` `rejectWithValue(errResp)` → a
  rejected *action*, but `dispatch()` itself RESOLVES (root cause confirmed). `ConfirmationDialog.tsx:27-46`
  `onClose` → `.then`(close) / `.catch`(clear loading + inline error + stays open); the `.catch` shipped in
  #1797 is genuinely present, and `.unwrap()` is exactly what turns the rejected-action-resolve into a
  promise-reject that routes through it. `errorHandling.tsx` `getErrorResponse` is double-parse-safe on the
  `AppError` payload (`toResponse` returns `undefined` → generic `'An error occurred'` inline; specific
  reason in the toast). The 13-file diff appends `.unwrap()` to 12 consumers + gates `TermDetails`' navigate
  on `.unwrap().then(...)`. Minimal, idiomatic, correct.
- **Gate 4 completeness — PASS (grep sweep of every `onConfirm` consumer):** all 12 fixed + TermDetails are
  redux-thunk dispatches; every UNFIXED consumer is correctly out of scope — `DatasetDataTableRowActions`,
  `DatasetFieldHeader`, `QueryExampleDetailsContainerActions`, `ActiveAssociationRequest`,
  `LookupTablesListItem` are all `mutateAsync` (already handled by #1797), and `SelectableSeverity` is a
  thunk that already `.unwrap()`s (since #1750, left untouched). **No thunk consumer missed.**
- **Unit bucket — PASS (reviewer's OWN run, Node 24 / vitest 4):** `DataSourceItem.test.tsx` +
  `TermDetails.test.tsx` = **4/4 GREEN** on the fix. They exercise the real store + thunk + `.unwrap()`, mock
  only the API boundary, and inject the rejecting condition explicitly. VERIFIED via `npx vitest run`.
- **IT-139 RED→GREEN — corroborated via the committed Playwright failure artifacts:** the `ref:main`
  (8615e9ed, port :18110) run shows the GENUINE bug symptoms — term `Received "…/termsearch/…"` (navigated
  away on the failed delete, PLT-234) + datasource `getByRole('dialog') element(s) not found` (closed-as-
  success, PLT-233), both with the `Forced 500` toast visible. GREEN on the fix (56f54a05). A real
  discriminator, not bug-hiding. VERIFIED via `e2e/test-results/confirmation-dialog-thunk-*` error-context.
- **G-C15 (the one CHANGED existing spec) — PASS:** `advisory-lock-registry.spec.ts` changed only
  `const CONN = '…:15432'` → `process.env.ODD_DB_URL ?? '…:15432'` (per-stream CONN parametrization,
  byte-identical for non-isolated/CI runs). No assertion weakened, no `.skip`, no mock swap.

### Contributor gates

- **G-C1 reproduce-first** — PASS (ARM-2 cited from CTRIB-027; term-navigate driven LIVE in IT-139, the RED
  artifact confirms the navigate-away).
- **G-C2 verify-running-system / FULL regression** — PASS-with-caveat. unit GREEN (own run); IT-139 RED→GREEN
  (corroborated); feature-complete `e2e:PASS` on the reviewed SUT 56f54a05 (run-log line 27, after the
  ECONNREFUSED infra fix); known-bugs `e2e:FAIL` = the 3 pins still RED, expected; multi-stack + ingestion-e2e
  = maintainer-approved FE-only skip (AskUserQuestion). **Caveat:** the run-logs record only BINARY pass/fail —
  the "311/311" + "3-RED/0-unexpected-green" counts are ledger narration, not in the citable run-log (rework
  (b); systemic — same gap flagged in the CTRIB-030 bounce). A reviewer FULL confirmation re-run was NOT done:
  the heavy-e2e flock is held by ctrib032 (G-C2 one-at-a-time), and the item bounces on the collision anyway —
  it is owed at the rework re-review.
- **G-C3 GATE 1** — PASS (`plan_approved_by` maintainer, AskUserQuestion, 2026-06-23, full ARM-2).
- **G-C4 GATE 2 + push-safety** — PASS (local): branch has **no upstream** + `push.default=current` (LSN-038
  guard intact); PR draft + `mergeable_state:blocked` per the ledger (the bot is PR author → cannot
  self-approve). Not re-fetched live (gh absent); the structural guarantee stands.
- **G-C5 bounded scope** — PASS: odd-platform diff = the 13 planned `.tsx` files only; ba44f06's run-suite.sh +
  advisory-lock isolation fixes are an honestly-documented test-enabler (minor, acceptable).
- **G-C6 one-question clarify** — PASS (none warranted, recorded).
- **G-C7 irreversible/ADR** — N/A (FE-only; no migration/auth/wire-contract change; `implicit-adrs.md` 0 hits).
- **G-C8 issue-as-data** — PASS (re-verified origin/main; found #1766 already 2/3 shipped; did not follow the
  stale issue text).
- **G-C9 test integrity (both buckets)** — substance PASS (genuine RED→GREEN both buckets); **IDENTITY FAIL →
  the IT-139 collision (the blocker).**
- **G-C10 ontology + docs move** — PASS: ontology committed (`737d5a5`; F-031 H-005 `release_gated_update`,
  not narrated); `docs_routing: none` well-grounded — `management.md:85` READ, already documents "the dialog
  stays open" for these deletes (fix brings released code into conformance). [One editorial nit on that line →
  DOC-482, non-blocking.]
- **G-C12 design-before-build** — PASS (reuse of the #1797 `.catch` + the `.unwrap()` idiom; impact checklist;
  PO/SRE lens; zero new components).
- **G-C13 principal sufficiency** — PASS (enough + meaningful tests; JaCoCo N/A for TS; no control lost).
- **G-C16 product analysis** — PASS (user problem restated independent of the issue's fix; HIGH→MEDIUM severity
  reframe surfaced at GATE 1).

### THE BLOCKER — IT-139 id collision (G-C9 identity / tests-pillar traceability)

Two **committed** protocols claim `id: IT-139`:
- `protocols/IT-139-confirmation-dialog-thunk-arm.md` — CTRIB-031, validates F-031, commit `ba44f06`
  (2026-06-23 11:12).
- `protocols/IT-139-term-linked-columns-pagination.md` — CTRIB-028, validates F-153 / regresses PLT-058,
  commit `436b695` (2026-06-22 14:51).

`run-suite.sh:81` resolves an IT id via `f=$(ls "$PROTODIR/$it"-*.md | head -1)`. For `IT-139` the glob
matches BOTH; `head -1` takes the alphabetically-first → `IT-139-confirmation-dialog-…`. So **CTRIB-031's
spec silently SHADOWS CTRIB-028's `term-linked-columns-pagination`** — F-153/PLT-058 is no longer runnable by
its id and is dropped from the suite's id-based enumeration. CTRIB-028's IT-139 predates CTRIB-031's by ~21h
→ CTRIB-031 reused an already-taken id. The tests pillar requires unique IT-NNN ids (the traceability
ledger / "no orphan tests" invariant); a duplicate that shadows another stream's regression test fails it.

### Rework (one pass — the `.tsx` fix itself needs NO change)

- **(a) [blocker] Renumber CTRIB-031's IT to `IT-141`** (IT-140 is taken by CTRIB-032; IT-141 is free):
  rename `protocols/IT-141-confirmation-dialog-thunk-arm.md` (+ `id: IT-141`); rename
  `e2e/specs/` reference + the spec header; update the protocol's `automation:` field; rename the run-log
  → `run-log/2026-06-23-IT-141.md`; update **suites.yaml in BOTH lists** (feature-complete + ui-e2e, + the
  ui-e2e comment); update the `lineage` F-031 gate refs (IT-139→IT-141) and `test-gates.yaml` if present;
  update this CTRIB record + `CTRIB-031-pr-body.md`. Leave CTRIB-028's
  `IT-139-term-linked-columns-pagination` as the **sole** IT-139. Re-run IT-141 RED→GREEN to regenerate the
  run-log under the new id.
- **(b) [evidence, systemic] Record actual COUNTS** (feature-complete 311/311; known-bugs 3-RED / 0-unexpected-
  green) + runner + SUT-source-SHA in the run-logs — not the binary `outcome:` line only (same gap flagged in
  CTRIB-030's bounce). The rework re-review owes the reviewer's own FULL confirmation regression on the
  rebuilt SUT (it could not run this pass — the heavy-e2e flock was held by ctrib032).
- **(c) [process, minor] Hand off contributor items at `pr-draft`**, not `review-ready` (review owns the
  pr-draft→review-ready flip on PASS); this item was set straight to `review-ready` pre-review.

### Outcomes

- **Regressions**: none observed (FE-only; unit GREEN own-run; IT-139 GREEN on fix; feature-complete e2e:PASS
  on 56f54a05). Count-granularity is the (b) caveat.
- **Navigation**: N/A — no navigation pointer shifts.
- **Banned-phrase check**: none used.
- **Upstream issues logged**: none new (PLT-238 + PLT-239 already on disk from implement).
- **Doc-product editorial findings** (partial pass — covered `management.md` via the Gate-10 read; full-tree
  audit DEFERRED to the re-review, per the CTRIB-028/CTRIB-030 2-minute-bounce precedent):
  - **DOC-482** (low, doc-claim-vs-code drift) — `management.md:85` "the dialog stays open with the cancel
    option highlighted" overstates the ConfirmationDialog failure UX (there is no cancel option to highlight).
    Logged: `backlog/docs/DOC-482.md`. Pre-exists CTRIB-031; non-blocking.
- **lineage/ left untouched** — unowned P-001 residue (O10); this review ran no probe/enrich → no ontology
  drift; the vitest run wrote nothing to the repo.
- **Committed (explicit paths)**: `contributor/CTRIB-031.md` (verdict + status flip) · `state/active-streams.yaml`
  (ctrib031 → blocked + `review-ctrib031` complete) · `state/PROGRESS.md` (review record) · `backlog/docs/DOC-482.md`.

## Rework (2026-06-23, maintainer-directed — "Renumber the IT to IT-141 and re-run")

The single blocker (the IT-139 id collision) is resolved. The `.tsx` fix is **byte-unchanged** (branch still
@ `a2a71af5`; PR #1801 unaffected — the IT lives in odd-team, not the odd-platform PR).

### Renumber IT-139 → IT-141 (surgical — CTRIB-028's IT-139 left intact)
- `git mv protocols/IT-139-confirmation-dialog-thunk-arm.md → IT-141-…` (+ `id: IT-141`, heading, run-suite examples, run-log ref).
- `git mv run-log/2026-06-23-IT-139.md → 2026-06-23-IT-141.md` (rewritten as a clean authoritative RED→GREEN record).
- Spec header in `confirmation-dialog-thunk-arm.spec.ts` IT-139→IT-141 (the filename has no id — unchanged).
- `suites.yaml` — IT-139→IT-141 in both the feature-complete + ui-e2e lists + the comment.
- lineage gate refs — `F-031.yaml:449` + `F-076.yaml:276` IT-139→IT-141 (the unowned P-001 residue left untouched — O10).
- `CTRIB-031-pr-body.md` IT-139→IT-141 (local copy; the **live PR #1801 body still reads "IT-139"** — an internal-id-only cosmetic divergence, optional to sync via the App).
- **Collision resolved**: `run-suite.sh IT-139` now uniquely globs CTRIB-028's `term-linked-columns-pagination`; `IT-141` globs this thunk-arm protocol. CTRIB-028's IT-139 (protocol + spec + refs) untouched.
- Left as historical (not rewritten): the `## Review` bounce narrative above, the 06-22/06-23 `feature-complete` suite-run snapshots, and the `state/*` verdict records.

### Re-run RED→GREEN under IT-141 (reviewer's own run, two CACHED images — no rebuild)
- **GREEN** — `ODD_PLATFORM_IMAGE=odd-platform:odd-team-sut-ctrib031` (digest `56f54a05`, the fix): `run-suite.sh IT-141` → **e2e:PASS, 2/2** (datasource dialog stays open + inline error; term delete stays on `/terms/{id}`).
- **RED** — `ODD_PLATFORM_IMAGE=odd-platform:odd-team-sut-ctrib031base` (digest `8615e9ed`, main/pre-fix): `run-suite.sh IT-141` → **e2e:FAIL, 2/2 as-expected** (term navigated to `…/termsearch/{uuid}` — PLT-234; datasource dialog closed-as-success — PLT-233).
- Record: `run-log/2026-06-23-IT-141.md` (annotated with runner + counts + evidence — addressing the run-log granularity gap, finding (b), for this IT). Both ephemeral stacks torn down after.

### Status + what remains
`blocked` → **`pr-draft`** (the contributor hand-off state; fixes the earlier `review-ready` mislabel, finding (c)). Still owed at the **fresh `/review`** (separate session, which flips `pr-draft → review-ready`; then human GATE-2 merge owns `done`): the reviewer's own FULL confirmation regression (feature-complete + known-bugs) with **counts recorded in those run-logs** (finding (b) at the full-regression level — the heavy-e2e flock was held during the bounce; both cached SUT images remain available for a fast re-run).
