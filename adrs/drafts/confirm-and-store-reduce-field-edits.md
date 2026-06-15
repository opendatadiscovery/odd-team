# ADR (draft) — Editing a consequential entity field goes through a change-preview confirmation that reduces the persisted result into the store

- **Status:** ACCEPTED (GATE-1-approved 2026-06-15) — **promoted to published ADR-0078** on documentation `release/0.28.0` @ 3ad09fb (`docs/developer-guides/architecture-decision-log/ADR-0078-confirm-and-store-reduce-field-edits.md` + the SUMMARY/README log-index rows; backlog tracker `backlog/adr/ADR-0078.md`, milestone 0.28.0). Reverse-engineered — *reconstructed from the codebase*. This draft keeps the long-form rationale + GATE-1 history; the published page is the canonical concise record. (CTRIB-015, odd-platform#1750.)
- **Date:** 2026-06-15
- **Driver:** odd-platform#1750 / CTRIB-015 — the DQ-test **Severity** control violates this pattern (instant fire-and-forget save, uncontrolled display, no store reduction), and the maintainer asked the right question at GATE 1: *"if we already have a pattern, why hasn't it emerged as an ADR for the same cases?"* This ADR makes the implicit decision explicit so severity (and every future consequential-field edit) conforms instead of re-inventing.
- **Related:** `pillars/adr/pillar.md` (publish to the ADR-log); the multilingual-UI feature (i18n); `feedback_search_existing_ui_pattern_before_building`.

## Context

Some editable fields are not cosmetic — their value drives downstream display or semantics that other people and systems trust:

- **Data-entity lifecycle Status** (`STABLE/DRAFT/DEPRECATED/DELETED/…`) drives soft-delete, lineage/group relations, and the header status badge.
- **DQ-test Severity** (`MINOR/MAJOR/CRITICAL`) drives `SLACalculator` → the dataset's aggregate SLA RED/ORANGE/GREEN colour an operator trusts at a glance (verified by IT-057).

For such a field, two properties matter: (1) **a change must be deliberate** — a single unconfirmed gesture must not silently reclassify a trusted signal; and (2) **the rendered value must equal the persisted record** — never an optimistic local guess that can diverge from what the backend actually stored (especially if the write fails).

The platform **already implements** the right shape for Status — but it was never written down, so the Severity control (added separately) drifted into the opposite shape. The drift is the bug (#1750): instant save on `onChange`, an *uncontrolled* `defaultValue` select, an unawaited dispatch, and a slice that never reduces the mutation result — which compounds into a render bleed where every sibling test shows the first-edited test's severity until a full refresh.

## Decision

**An editable field whose value drives downstream display or semantics is edited through a confirmation, and the persisted result is reduced into the store. No optimistic instant-save.** Concretely, the established pattern (reconstructed from the entity-Status implementation) is:

1. **A selectable control, not an auto-committing input.** The current value is shown; choosing a new value opens a **confirmation dialog** rather than persisting immediately. Reuse `ConfirmationDialog` / `DialogWrapper` (trigger-driven) composed in an `AppMenu` of options — the shape of `SelectableEntityStatus` → `StatusSettingsForm`.
2. **The confirmation previews the change** — *what is going to change* (old → new) — and carries any **additional change configuration** the field needs (e.g. Status's switch-time / propagate; many fields, e.g. Severity, need none — the slot is optional).
3. **The mutation is awaited** (`.unwrap()`), with the success/error toast surfaced; on failure nothing is persisted and the displayed value stays the stored value.
4. **The server result is reduced into the Redux store** (a slice `extraReducers` `.fulfilled` case or an action like `updateEntityStatus`) so the rendered value derives from the persisted record **without a refetch** — and so it can never show an unsaved value as if it were stored.
5. **The displayed value derives from the store** (controlled), keyed by the current entity/route, so navigating between records never bleeds one record's value onto another. Where a list/detail panel reuses a mounted component across record identities, the route element carries `key={recordId}` so a switch remounts cleanly.

**Reference implementation:** `SelectableEntityStatus` + `StatusSettingsForm` + `ConfirmationDialog`/`DialogWrapper` + `dataentities.slice.ts` `updateEntityStatus`. **First conformer this ADR brings into line:** DQ-test Severity (`TestReportDetailsOverview`) — see CTRIB-015.

## Alternatives considered

- **Optimistic instant-save** (the current Severity behaviour). Rejected for consequential fields — a mis-click silently reclassifies a trusted signal, and an unawaited write lets the UI show a value the backend never accepted.
- **Inline "Save" button** (a controlled select + a dirty-state Save). Rejected at GATE 1 — it is a *parallel* affordance that re-invents confirmation instead of reusing the dialog pattern the platform already ships; it also drops the "preview what changes / room for change-config" property. (This was the author's first proposal; the maintainer correctly rejected it.)
- **Per-screen bespoke confirm each time.** Rejected — that is how the drift happened; standardise on the one pattern.

## Consequences

- A consistent, deliberate, non-divergent way to edit any consequential field; Status is the existing adopter, Severity the next, future fields conform without re-deciding.
- No new shared primitive is introduced — the pattern composes `ConfirmationDialog` / `DialogWrapper` / `AppMenu`, all already shipped. (A thin per-field selectable wrapper — e.g. `SelectableSeverity` — mirrors `SelectableEntityStatus`.)
- A confirm step per change is the accepted cost; it is correct for fields that drive trusted signals (it is *wrong* for trivial cosmetic inputs — this ADR scopes to **consequential** fields, not every form input).
- **Publication:** an ADR-log entry (docs Developer-Guides, `pillars/adr/pillar.md` lifecycle) records the pattern as reconstructed-from-codebase, alongside the Status reference. Routing (docs `main` now vs the 0.28.0 train) confirmed at sign-off — the developer-facing record can publish when the work lands; the user-facing *behaviour* (the Severity confirm) ships with the 0.28.0 code.

## Open for GATE 1

- Confirm the **reuse-the-Status-pattern** direction (menu + `ConfirmationDialog` + store-reduce), superseding the inline-Save proposal.
- The per-field wrapper name (`SelectableSeverity`) and whether it co-locates with `TestReportDetailsOverview` (one consumer today) or lands in `shared/elements` (promote when a 2nd consumer appears).
