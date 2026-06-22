---
ctrib: CTRIB-031
github_issue_number: 1766
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1766
title: "ConfirmationDialog ARM-2 (redux-thunk): a refused destructive confirm closes-as-success / term-delete navigates away — finish #1766"
class: bug
scope: frontend
milestone: "0.29.0"          # open + semver (verified via GitHub API) → G-C11 PASSES (no hard stop)
status: planned              # Phase A–C done; STOPPED at GATE 1 (plan approval). No code yet (G-C3).
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
plan_approved_by:            # GATE 1 — pending
plan_approved_at:
plan_approved_scope:
docs_routing: none           # to be READ-confirmed in Phase D (management.md / master-data-management.md) before asserting (G-C10)
pr_url:                       # not opened — GitHub-write blocked (odd-contributor App not configured); handover at Phase E
pr_draft: true
clarify_comment_url:
rootcause_comment_url:
scope_comment_url:
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

## Test / doc / ontology ledger (Phase D)
_(empty — implementation begins only after GATE 1 approval.)_

**GitHub-write status:** the `odd-contributor` App is NOT configured here (`GH_APP_ID`/`GH_INSTALLATION_ID`
unset). Per `playbooks/github-write.md` on-fail, do NOT fall back to a PAT. The scope comment + branch push +
draft PR are a **maintainer handover** at Phase E (same as CTRIB-027). The "scope comment before any code"
invariant holds at the public layer — nothing becomes public until the maintainer runs the GitHub steps.
