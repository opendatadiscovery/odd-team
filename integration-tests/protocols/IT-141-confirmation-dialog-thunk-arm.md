---
id: IT-141
title: "A failed destructive confirm on a redux-thunk consumer must not close-as-success / navigate away"
gates:
  validates: [F-031]
  enforces: []
  regresses: [PLT-233, PLT-234]
test_class: integration
stack: odd-minimal
automation: "e2e:confirmation-dialog-thunk-arm.spec.ts"
plan_ref: "CTRIB-031"
status: ready
---

# IT-141 — a failed destructive confirm on a redux-thunk consumer must not close-as-success

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any tooling. The
> `automation:` e2e rail runs the same steps and writes the same result; it never replaces the protocol.

## 1. What this checks

The shared `ConfirmationDialog` sits behind two kinds of consumer. IT-138 covers the **mutateAsync** arm
(the #1797 stuck-spinner). This covers the **redux-thunk** arm: the ~13 consumers that pass a bare
`dispatch(thunk(...))` to `onConfirm`. A redux-toolkit dispatch promise **resolves even on a rejected
action**, so on a refused destructive confirm the dialog used to **close exactly as on success** — and
the term-delete consumer additionally **navigated to term-search as if the term were deleted**.

The fix appends `.unwrap()` in the consumers: the dispatch now **rejects** on the rejected action, so the
dialog's `.catch` keeps it open with the error and the term's `.then(navigate)` only runs on success.

**Operator consequence if it FAILS (the PLT-233 / PLT-234 regression):** an operator confirms a delete the
backend refuses (cascade-block `USR004`, RBAC 403, 500, network) and the UI **signals success** — the modal
closes (datasource/role/owner/policy/…), or for a term the app **navigates away as if it were deleted** —
contradicting the error toast. RED here = a consumer regressed to a bare `dispatch(...)` (no `.unwrap()`).

Source: `#1766` ARM-2 / `PLT-233` (thunk-arm silent close) + `PLT-234` (term navigate-away); CTRIB-031.
The thunk arm is driven on two surfaces: **data-source delete** (F-031, a Management thunk consumer) and
**term delete** (the navigate-away — the sharpest instance).

## 2. Preparation — build the test stand

Fast tier (read-path / UI mechanics): direct platform-DB seed + a forced HTTP failure. No collector — the
behaviour under test is pure front-end error handling, independent of any source mapping.

- **Stack**: `odd-minimal` (Postgres + odd-platform). `ODD_STACK_EXTERNAL=1` reuses a running stack.
- **Auth/config**: `AUTH_TYPE=DISABLED` (odd-minimal default — the synthetic admin has `DATA_SOURCE_DELETE`
  and `TERM_DELETE`, so both affordances render).
- **Seed data**:
  - a data source (`seedDataSource(931766, 'ct031_ds_thunk_arm')` — idempotent `ON CONFLICT`, renders at
    `/management/datasources`);
  - a glossary term (`seedTermWithDefinition('CT031TermThunkArm', …)` → its id, renders at
    `/terms/{id}/overview`).
- **Forced failure**: the spec route-intercepts `DELETE /api/datasources/{id}` and `DELETE /api/terms/{id}`
  and fulfils `500` with a JSON body `{ "message": "Forced 500 (CTRIB-031 thunk-arm repro)" }`. Any real
  refusal drives the identical front-end path; the interception makes it deterministic.

## 3. Readiness check — is the stand ready?

- Platform health: `curl -fsS http://127.0.0.1:18080/actuator/health` → `{"status":"UP"}`
  (under `ODD_STREAM=<id>` the port is the stream's API port, not 18080).
- The seeded data source renders at `/management/datasources`; the term renders at `/terms/{id}/overview`.

## 4. Run protocol — what to run

**Datasource (PLT-233):**
1. Open `/management/datasources`; wait for the `ct031_ds_thunk_arm` row.
2. Hover the row (actions are `opacity:0` until hover), click **Delete**, then the **Delete** confirm button.
3. The intercepted DELETE returns 500; observe the dialog.

**Term (PLT-234):**
1. Open `/terms/{id}/overview`; wait for the term name.
2. Open the header **kebab** menu, click **Delete**, then the **Delete term** confirm button.
3. The intercepted DELETE returns 500; observe the URL + the dialog.

**Automated rail**: `integration-tests/run-suite.sh IT-141`
(RED proof: `ODD_SUT=ref:main integration-tests/run-suite.sh IT-141`).

## 5. What it checks — assertions

- **Datasource — PASS** (fixed) when, after the failed delete: the dialog is **still open** (the confirm
  title still shows), the **inline error** appears (generic `An error occurred` — the specific reason is in
  the toast), and the **row remains**. **FAIL** (the bug) when the dialog **closes** (close-as-success).
- **Term — PASS** (fixed) when, after the failed delete: the URL **stays** on `/terms/{id}` and the dialog
  stays open. **FAIL** (the bug) when the app **navigates away** to term-search (URL leaves `/terms/{id}`).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-141.md` (date · SUT digest · runner · outcome ·
evidence · notes).

## Cross-references
- Source: `#1766` ARM-2 / `PLT-233` + `PLT-234`; CTRIB-031 (`contributor/CTRIB-031.md`).
- Sibling: IT-138 (the mutateAsync arm, CTRIB-027) — same dialog, the OTHER consumer kind.
- Code: the 13 thunk consumers' `.unwrap()` (e.g. `Management/DataSourcesList/DataSourceItem/DataSourceItem.tsx`,
  `Terms/TermDetails/TermDetails.tsx` navigate-gating). Shared `ConfirmationDialog.tsx` unchanged (already
  fixed by #1797). Evidence: `integration-tests/e2e/test-results/ctrib031-{datasource-thunk-arm,term-navigate-gating}.png`.
- Unit complement (odd-platform CI / vitest): `DataSourceItem.test.tsx` (dialog stays open) +
  `TermDetails.test.tsx` (navigate gated on success).
