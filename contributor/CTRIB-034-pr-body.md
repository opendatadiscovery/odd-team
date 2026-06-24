# DRAFT PR body — odd-platform#1803 (CTRIB-034)

**Title:** `fix(ui): reflect alert status change without refresh + confirm before flipping (#1803)`
**Base:** `main` · **Head:** `contrib/CTRIB-034-alert-status-reflect-confirm` · **draft: true**

---

Closes #1803

## What

Two front-end defects in the alert status-change flow, reproduced live on a running stack before the fix:

1. **Stale per-entity Alerts tab.** On the Data Entity → Alerts tab, clicking **Resolve**/**Reopen** fired a
   success toast ("Alert successfully resolved.") but the row kept showing the old status (badge "Open", button
   "Resolve") until a page reload. The back end persisted correctly — the view went stale.
2. **No confirmation before the flip** on either surface (the per-entity tab and the global `/alerts` page): a
   single click changed an alert's triage state with no "are you sure?".

## Root cause

- **Defect 1** — a payload-key mismatch. The `updateAlertStatus` thunk returned the entity id under the key
  `dataEntityId`, while the reducer reads `entityId` (always `undefined`), so the `if (dataEntityId)` per-entity
  update branch was unreachable and the write fell through to the global `state.alerts.items` — which the
  per-entity tab does not render (the global `/alerts` page dispatches *without* an entity id, so its
  fall-through correctly updates the list it renders, which is why only the per-entity tab went stale).
- **Defect 2** — the Resolve/Reopen trigger dispatched directly from the button `onClick` with no dialog.

## The change (front-end only — no API, migration, or auth-posture change)

- **Defect 1:** emit `entityId: params.entityId` from the thunk — the key the reducer and the sibling
  `fetchDataEntityAlerts*` thunks already use, and the one the thunk's `Partial<EntityId>` return type declares.
  One line; the existing (previously-dead) per-entity in-place update now runs, so the tab re-renders without a
  refetch.
- **Defect 2:** wrap the Resolve/Reopen trigger in the existing `ConfirmationDialog` on **both** surfaces, with
  `.unwrap()` on the dispatched thunk so a failed status change surfaces in the dialog instead of closing as
  success (the #1766 idiom). On the global page the per-entity permission pre-fetch is folded into `onConfirm`,
  so the dialog's own loading/error state replaces the bespoke `isUpdating`/`disableResolve`/"No access!" state.
- New confirmation strings added to **all 7 locale catalogs** (en/ua/ch/es/br/fr/hy; key-parity guard green).

## Scope (deliberately excluded)

No back-end change (the back end persists correctly); no change to the success toast; no defensive rewrite of
the now-activated reducer branch (the per-entity tab always populates `dataEntityAlerts[id]` before the button is
clickable — no reachable NPE); no change to the global page's permission *model* (only folded into `onConfirm`);
no other thunks (the two sibling per-entity thunks are already key-consistent). The separate manual-resolve
housekeeping retention bug is unchanged and out of scope.

## Verification (the running system, not just the diff)

- **Reproduced** both defects in a real browser on a running stack before fixing (toast-vs-stale-badge; no dialog
  on either surface), so the report's `user_facing_verified` moves to `true`.
- **Unit:** a redux store test runs the real `updateAlertStatus` thunk through the real reducer and asserts the
  per-entity slice updates in place — RED on the pre-fix `dataEntityId` key, GREEN on the fix.
- **Browser e2e:** a new Playwright spec asserts the confirmation dialog gates the flip on both surfaces and the
  per-entity row reflects the new status without a reload — 3/3 RED on the pre-fix build, 3/3 GREEN on the fix.
- **Full regression** against an image built from this branch: feature-complete **316/0** (incl. the new spec
  3/3), multi-stack **9/0**, known-bugs **3 expected-RED** (no unexpected green), ingestion-e2e **6/0**. The Java
  CI replica (`:odd-platform-api:build`) is green; `tsc --noEmit` and eslint are clean.

Milestone: 0.29.0
Docs: documentation@release/0.29.0 — the alerting page's "no confirmation dialog" Known UX limitation is corrected
to describe the new safeguard; publishes with the 0.29.0 release.
