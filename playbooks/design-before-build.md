---
playbook: design-before-build
status: active
since: 2026-06-13
applies_to: universal
---

# PROTOCOL design-before-build

Once the WHAT is understood, decide the HOW *before* writing non-trivial code — by reusing what already
exists, conforming to (or proposing) an ADR, viewing the change through the people who use and own it, and
enumerating its full blast radius. The analysis tools are already in hand (the ontology graph with
semantic search, the source, the implicit-adrs catalogue, the ADR-log, the `odd-sme`); this protocol
forces their use so the default stops being "build from scratch." (`retrospectives/LSN-035`.)

## trigger

A planning phase that is about to design a **non-trivial change** — any new component / endpoint / UI
affordance / field / contract, or any change a maintainer would call a "feature" rather than a one-line
fix. Fires in `/contribute` Phase C (before GATE 1) and in `/implement` before authoring a feature-shaped
item. Skip only for genuinely mechanical edits (a typo, a null-guard, a doc-string) — and say so.

## inputs

- the understood WHAT (the scope analysis / issue intent / the feature to add)
- the target repo + the affected area (features / nodes from `/code-walk` or `/retrieve`)
- whether the change is **feature-shaped** (introduces or changes user-observable behaviour) vs. internal

## procedure

1. **Reuse-scan (do NOT build what exists).** For each new thing the change would introduce (a component,
   a helper, a pattern, an endpoint shape), look for an existing one FIRST:
   - `/retrieve` — semantic-search the ontology for the capability ("inline help affordance",
     "paginated distinct list endpoint", "filter dropdown"), not just the literal name.
   - targeted grep of the source by behaviour (`AppTooltip`, `AppPopover`), by icon/label, by sibling
     feature. The duplication-sweep (`playbooks/duplication-sweep.md`) generalises here from docs to code.
   - **Reuse the existing thing, or justify a new one in one sentence** that says why nothing fit. A new
     artefact that duplicates an existing pattern is a defect (CLAUDE.md "subtract before you add").
2. **ADR-check (conform, or propose — never invent a parallel).** For the area being changed, read
   `lineage/{repo}/implicit-adrs.md` + the published ADR-log (docs Developer Guides). Then:
   - if an ADR governs the area → conform to it (or, if you must deviate, that is a G-C7 architectural
     stop, not a silent divergence);
   - if there is an existing or **emerging** pattern with NO ADR → propose one (a draft in `adrs/drafts/`),
     written to **reverse-engineer the existing pattern** (status accepted, "reconstructed from the
     codebase"), not to christen a new invention. The reuse from step 1 is its evidence.
3. **Impact-dimension checklist (no silent backlog deferral).** Walk every dimension a change of this
   shape touches; each is either handled in THIS change or explicitly + traceably deferred (a logged
   item), never dropped:
   - **i18n** — any new user-facing string is added to **all** locale files (the platform ships
     `en/br/es/fr/ch/ua/hy`); a machine translation is best-effort and marked, but en-only-plus-backlog
     is the anti-pattern this checklist exists to stop.
   - **generated clients** — a contract (OpenAPI / proto) change regenerates the BE interfaces AND the FE
     client; both consumers compile.
   - **every consumer** — each caller of a changed signature / response shape / query param (grep them;
     do not assume).
   - **migration** — schema or default change has a migration + a rollback story.
   - **docs + ontology** — the page(s) and sidecars/feature-flows the change makes stale (G-C10).
   - **tests** — the buckets the change demands (set the sufficiency bar here; verified at G-C13).
4. **Product-Owner / SRE lens (feature-shaped changes only).** Spawn `odd-sme` (or, for a UX-shape call
   inside the maintainer's expertise, reason it explicitly) to answer, from the operator's chair:
   - does this help an SRE / data engineer actually *do their work* (onboard a source, find an owner,
     trace a stale dashboard), or is it an abstract feature shell?
   - is it the **straightforward** shape — does a control show exactly what a user expects (e.g. a filter
     dropdown lists the values it filters on), do labels mean what they say, is the default sane?
   - what does a Product-Owner expect *by default* that the plan omits (an empty state, a consistent
     name, a discoverable affordance)?
   Record the consultation (the `odd-sme` note at `lineage/{repo}/sme-consultations/`) and fold its
   findings into the plan BEFORE building — not after the maintainer catches them at review.
5. **LOOK at the rendered result (UI changes — verify the pixels, not just the behaviour).** A passing
   e2e proves a control *functions*; it does NOT prove it is *legible or usable*. After building (and
   before "done"), **drive the running UI and screenshot the actual rendered surface** (the e2e harness
   can: `page.screenshot(...)`), then review it as a user would: contrast / background, text wrapping vs.
   a single unreadable row, width, truncation, alignment, empty state, the affordance's discoverability.
   A tooltip with no background and an unwrapped one-line wall of text "works" and is still a defect you
   would be ashamed to show a user (LSN-035, the second instance). If you reuse a styled pattern (G-C12
   step 1), reuse its **content container** too (e.g. the existing info tooltip's styled body), not just
   its outer component — a bare string in a styled wrapper renders raw.

## exit

The plan (the GATE-1 artefact) explicitly states, before any code:

- what existing pattern / component each new-looking part **reuses** (or the one-sentence justification
  for new);
- the ADR it conforms to, or the ADR it proposes for an undocumented existing/emerging pattern;
- the impact-dimension checklist, each dimension handled-here or deferred-with-a-logged-item (i18n
  covered for all locales, not deferred);
- for a feature-shaped change, the Product-Owner/SRE assessment and what it changed in the plan;
- for a UI change, a **screenshot of the rendered result** was reviewed for legibility / styling /
  wrapping / empty-state — not just a green e2e — before "done".

## on-fail

- An existing pattern is found mid-build (not at planning) → stop, refactor to reuse it, and record the
  miss (this is the LSN-035 failure; the gate exists to move the catch left to planning).
- The PO/SRE lens reveals the shape is wrong → re-plan the shape before continuing; do not ship the
  first-draft shape and "fix it at review."
- A dimension cannot be handled in-change → log a tracked item NOW (`playbooks/follow-up-on-disk.md`) and
  name it in the plan; never leave it implicit.

## case-law

- `retrospectives/LSN-035-design-before-build-reuse-perspective-impact.md` — CTRIB-010 built a duplicate
  `(i)` affordance, skipped the PO/SRE lens, missed test sufficiency, and left i18n en-only — four gaps,
  one missing "design the HOW" step; this protocol is the fix.
- `retrospectives/LSN-009-backlog-internal-duplication.md` — grep-the-existing-first before creating (the
  duplication principle, here applied to code patterns, not only backlog items).
