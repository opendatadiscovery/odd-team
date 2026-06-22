---
id: IT-138
title: "A failed destructive confirm un-wedges the shared ConfirmationDialog (no stuck spinner; inline error)"
gates:
  validates: [F-058]
  enforces: []
  regresses: [PLT-163]
test_class: integration
stack: odd-minimal
automation: "e2e:confirmation-dialog-failed-action.spec.ts"
plan_ref: "CTRIB-027"
status: ready
---

# IT-138 — a failed destructive confirm un-wedges the shared ConfirmationDialog

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any tooling. The
> `automation:` e2e rail runs the same steps and writes the same result; it never replaces the protocol.

## 1. What this checks

The shared `ConfirmationDialog` (behind every destructive action) must NOT freeze when the confirmed
`mutateAsync` action is refused by the backend. On a non-2xx, the dialog clears its loading state (so it is
no longer mouse-dead — `DialogWrapperStyles.ts` sets `pointer-events:none` while loading), surfaces the
server reason **inline**, and stays open so the operator can read it and retry / cancel.

**Operator consequence if it FAILS (the PLT-163 / #1766 regression):** an operator who confirms a
destructive action the backend refuses (cascade-block `USR004`, RBAC 403, 500, network) gets a modal frozen
with a spinning bar and every mouse interaction dead — recoverable only by reloading the page. RED here =
the `ConfirmationDialog.onClose` `.catch` is swallowing the rejection again (the `isLoading` reset / inline
error regressed).

Source: `#1766` / `PLT-163` (the shared-component swallow); CTRIB-027. The mutateAsync arm is driven on the
lookup-table delete surface (F-058), one of the ~10 `mutateAsync` consumers.

## 2. Preparation — build the test stand

Fast tier (read-path / UI mechanics): direct platform-DB seed + a forced HTTP failure. No collector — the
behaviour under test is pure front-end error handling, independent of any source mapping.

- **Stack**: `odd-minimal` (Postgres + odd-platform). `ODD_STACK_EXTERNAL=1` reuses a running stack.
- **Auth/config**: `AUTH_TYPE=DISABLED` (odd-minimal default — the synthetic admin has `LOOKUP_TABLE_DELETE`).
- **Seed data**: one lookup table created via the real API (`POST /api/referencedata/table`, helper
  `createLookupTable`), namespace `ct027_ns`, name prefix `ct027_`. Idempotent + cleaned by prefix.
- **Forced failure**: the spec route-intercepts `DELETE **/api/referencedata/table/**` and fulfils `500`
  with a JSON body `{ "message": "Forced 500 (CTRIB-027 repro)" }`. Any real refusal (cascade-block 400,
  RBAC 403, network) drives the identical front-end path; the interception makes it deterministic.

## 3. Readiness check — is the stand ready?

- Platform health: `curl -fsS http://127.0.0.1:18080/actuator/health` → `{"status":"UP"}`
- The seeded table renders at `/master-data/lookup-tables` (the spec waits for it before acting).

## 4. Run protocol — what to run

1. Seed the lookup table; open `/master-data/lookup-tables`; wait for the row.
2. Hover the row (reveals the `HiddenCell` actions), click **Delete**, then the **Delete lookup table**
   confirm button.
3. The intercepted DELETE returns 500; observe the dialog.

**Automated rail**: `integration-tests/run-suite.sh IT-138`
(RED proof: `ODD_SUT=ref:main integration-tests/run-suite.sh IT-138`).

## 5. What it checks — assertions

- **PASS** (fixed) when, after the failed delete: the dialog is **still open**; the `LinearProgress`
  spinner is **hidden** (loading cleared); the dialog root computes `pointer-events: all` (interactive
  again); and the **inline error** inside the dialog shows the server message.
- **FAIL** (the bug) when: the spinner keeps running, the dialog root computes `pointer-events: none`
  (wedged / mouse-dead), or no inline error appears — i.e. the rejection was swallowed.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-138.md` (date · SUT digest · runner · outcome ·
evidence · notes).

## Cross-references
- Source: `#1766` / `PLT-163`; CTRIB-027 (`contributor/CTRIB-027.md`). Reproduction evidence:
  `integration-tests/e2e/evidence/ctrib027-arm1-wedged.png`.
- Code: `odd-platform-ui/src/components/shared/elements/ConfirmationDialog/ConfirmationDialog.tsx` (the
  `.catch` fix), `DialogWrapper.tsx` (the reused `errorText` prop).
- Deferred siblings (out of CTRIB-027 scope): PLT-233 (thunk-arm silent-close), PLT-234 (term-delete
  navigate-away).
