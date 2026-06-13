# ADR (draft) — A reusable inline info `(i)` popover affordance for the platform UI

- **Status:** draft — GATE 1 sign-off required (CTRIB-010, odd-platform#1657). Maintainer-directed
  (2026-06-13): author + build in THIS ticket, do not defer to a later release.
- **Date:** 2026-06-13
- **Driver:** odd-platform#1657 / CTRIB-010 — the Activity feed needs inline concept help to make the
  User vs Owner distinction crystal clear; the help affordance is generic and worth standardising once.
- **Related:** `adrs/drafts/activity-actor-filter-audit-identity.md` (the actor-filter change that is the
  first consumer); the multilingual-UI feature (i18n); `pillars/adr/pillar.md` (publish to the ADR-log).

## Context

The platform exposes concepts whose meaning is non-obvious from a label alone (the clearest case:
the Activity "Owner" vs "User" filters, where "Owner" means the asset's owner, the current "User" filter
means the actor's *current* owner via a mutable association, and neither is the external user identity —
see `adrs/drafts/activity-actor-filter-audit-identity.md`). Today the only ways to explain such a concept
are (a) a longer label (clutters the UI), (b) a MUI `Tooltip` (hover-only, short text, no links, poor on
touch), or (c) prose in the docs (out of the user's flow). There is no standard, reusable way to attach
**rich, in-context help** (a short explanation + optionally links) to a UI element.

## Decision

Introduce a single reusable primitive — an inline **information affordance**: a small `(i)` icon button
rendered next to a label/control that, on activation, opens a **popover** containing structured help.

1. **Component.** A new shared component `components/shared/elements/InformationHint/InformationHint.tsx`
   (working name) with props:
   - `title?: string` — a short heading.
   - `content: React.ReactNode` — the explanation (paragraphs / bullet list).
   - `links?: { label: string; href: string }[]` — optional "learn more" links (open in a new tab;
     external links to `docs.opendatadiscovery.org` allowed).
   - `iconSize?` / placement props as needed.
2. **Built on MUI** (the platform's component library): a `(i)` `IconButton` + MUI **`Popover`**
   (click-to-open / dismiss-on-outside-click), NOT `Tooltip`. Rationale: a click popover supports rich
   content + links + keyboard + touch; hover tooltips do not and are inaccessible on touch devices.
3. **Icon.** Reuse an existing info glyph in `components/shared/icons` if one exists, else add an
   `InfoIcon` there (the platform's icon set), so styling stays consistent.
4. **Text via i18n.** All strings come through `react-i18next` (the platform already ships a multilingual
   UI), so help content is translatable — the help text must never be a hardcoded literal.
5. **Accessibility.** `aria-label` on the trigger, keyboard-openable, MUI Popover focus management;
   `aria-haspopup`.
6. **Usage.** Render inline, immediately after the label it explains. First consumer: the three Activity
   filter labels (Owner of asset / actor's current Owner / external User name) and the action-row
   actor names (CTRIB-010). The component itself is feature-agnostic.

## Alternatives considered

- **MUI `Tooltip` (hover).** Rejected — short text only, no links, fails on touch, poor a11y for rich help.
- **Inline helper text under the control.** Rejected — clutters dense filter panels; does not scale to
  many controls.
- **Docs-only explanation.** Rejected for this class — the confusion is *at the control*; help must be
  in-flow. (The docs page stays the canonical deep reference, linked from the popover.)
- **A bespoke per-screen tooltip each time.** Rejected — that is the status quo that produced the
  inconsistency; standardise once.

## Consequences

- A consistent, accessible, translatable way to attach in-context concept help anywhere in the UI;
  the Activity feed is the first adopter, future surfaces can reuse it without re-deciding.
- One new shared component + (maybe) one icon; no new dependency (MUI + i18next already shipped).
- **Publication (maintainer directive — not gated to 0.28.0):** a published ADR-log entry in the docs
  Developer-Guides ADR log (`pillars/adr/pillar.md` lifecycle) records the pattern. The ADR is a
  developer-facing decision record; per the maintainer it publishes when this work lands rather than
  waiting for the 0.28.0 operator-doc train. The user-facing *behaviour* (the popovers themselves) still
  ships with the 0.28.0 code.
- Scope guard: this ADR defines the affordance + its first use. It does NOT mandate retrofitting every
  existing ambiguous label — those are follow-ups adopted incrementally.

## Open for GATE 1

- Component + icon names (`InformationHint` / `InfoIcon` — or the maintainer's preferred names).
- Whether the ADR-log entry publishes to docs `main` now vs rides the 0.28.0 train (the maintainer
  asked for "now"; confirming the routing at sign-off).
